import { useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Menu, Row, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import useAssetLookups from '../../hooks/useAssetLookups';
import { toastUnlessHandled } from '../../utils/apiError';
import { triggerBrowserDownload } from '../../utils/download';
import { companyForPrint } from '../../utils/printCompany';
import { getReportDefinitions, runReport, exportReport } from '../../services/asset/reportService';
import { getDisposalOptions } from '../../services/asset/disposalService';
import { getEmployeeOptions } from '../../services/asset/assetService';
import { getRuns } from '../../services/asset/verificationService';
import { printAssetReport } from './reports/assetReportPrint';
import AssetReportFilters from './reports/AssetReportFilters';
import AssetReportResult from './reports/AssetReportResult';

const EXT = { EXCEL: 'xlsx', PDF: 'pdf', CSV: 'csv' };

/**
 * The nine fixed reports of PRD section M.
 *
 * Fixed on purpose: the PRD rules out a report designer here, and the ERP
 * already has one for anybody who wants to build their own. These nine are the
 * questions the floor asks often enough to deserve a button.
 *
 * Which filters each report takes comes from the server, so this screen draws
 * the bar from that list instead of keeping its own copy of the table.
 */
const AssetReports = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const lookups = useAssetLookups();
  const [definitions, setDefinitions] = useState([]);
  const [code, setCode] = useState(null);
  const [values, setValues] = useState({});
  const [range, setRange] = useState(null);
  const [report, setReport] = useState(null);
  const [ranAt, setRanAt] = useState(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(null);
  const [extra, setExtra] = useState({ methods: [], runs: [], employees: [] });

  useEffect(() => {
    getReportDefinitions()
      .then((list) => { setDefinitions(list); setCode(list[0]?.code ?? null); })
      .catch((e) => toastUnlessHandled(message, e, 'Could not load the reports'));
    // Lookups the server already serves. Mirroring the disposal methods here
    // would be a second copy of an enum to keep in step, and a report filter is
    // no reason to grow one.
    Promise.all([
      getDisposalOptions().catch(() => ({ methods: [] })),
      getRuns({ page: 0, size: 100 }).catch(() => ({ content: [] })),
      getEmployeeOptions().catch(() => []),
    ]).then(([disposal, runs, employees]) => setExtra((e) => ({
      ...e,
      methods: disposal.methods ?? [],
      runs: (runs.content ?? []).map((r) => ({ value: r.id, label: `${r.runNo} - ${r.name}` })),
      employees: Array.isArray(employees) ? employees : [],
    })));
  }, [message]);

  const definition = useMemo(() => definitions.find((d) => d.code === code), [definitions, code]);

  /** The server returns at most 25 employees a search, so the picker asks it. */
  const onEmployeeSearch = async (search) => {
    try {
      const found = await getEmployeeOptions(search);
      setExtra((e) => ({ ...e, employees: Array.isArray(found) ? found : [] }));
    } catch { /* an empty picker already reads as "nothing found" */ }
  };

  /** A new report keeps nothing from the last one: its filters are different. */
  const choose = (next) => {
    setCode(next);
    setValues({});
    setRange(null);
    setReport(null);
  };

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const filter = () => ({
    ...values,
    unitId: values.unitId ?? null,
    categoryId: values.categoryId ?? null,
    from: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
    to: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
  });

  const run = async () => {
    setRunning(true);
    try {
      const result = await runReport(code, filter());
      // Stamped when the rows arrive. The header used to read the clock as it
      // drew, so a report left on screen went on claiming to be fresh.
      setRanAt(dayjs());
      setReport(result);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not run the report');
    } finally {
      setRunning(false);
    }
  };

  const download = async (format) => {
    setBusy(format);
    try {
      const blob = await exportReport(code, filter(), format);
      triggerBrowserDownload(blob, `${code.toLowerCase()}_${Date.now()}.${EXT[format]}`);
    } catch (e) {
      toastUnlessHandled(message, e, `Could not export the ${format.toLowerCase()}`);
    } finally {
      setBusy(null);
    }
  };

  const printNow = async () => {
    if (!report) return;
    const org = await companyForPrint();
    const opened = printAssetReport({
      title: definition?.label ?? 'Asset report',
      columns: report.columns,
      rows: report.rows,
      companyName: org?.organisationName ?? '',
      filterSummary: lookups.options.units.find((u) => u.value === values.unitId)?.label,
    });
    if (!opened) message.warning('Your browser blocked the print window — allow pop-ups for this site.');
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Reports"
        subtitle="Nine fixed reports, with Excel, PDF and print"
        onBack={() => navigate('/assets')}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
          <Card styles={{ body: { padding: 0 } }}>
            <Spin spinning={!definitions.length}>
              <Menu
                mode="inline"
                selectedKeys={code ? [code] : []}
                onClick={({ key }) => choose(key)}
                items={definitions.map((d) => ({ key: d.code, label: d.label }))}
                style={{ borderInlineEnd: 0 }}
              />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={18}>
          <AssetReportFilters
            definition={definition}
            values={values}
            set={set}
            range={range}
            onRange={setRange}
            lookups={lookups}
            extra={{ ...extra, onEmployeeSearch }}
            onRun={run}
            onExport={download}
            onPrint={printNow}
            running={running}
            busy={busy}
            hasReport={!!report}
          />

          <AssetReportResult report={report} ranAt={ranAt} title={definition?.label} loading={running} />
        </Col>
      </Row>
    </div>
  );
};

export default AssetReports;
