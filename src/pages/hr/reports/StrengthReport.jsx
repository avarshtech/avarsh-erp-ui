import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Col, Row, Tag, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import useUrlFilters from '../../../hooks/useUrlFilters';
import { useBranch } from '../../../context/BranchContext';
import { getActiveUnits } from '../../../services/master/unitService';
import { getStrengthReport, exportStrengthReport } from '../../../services/hr/strengthReportService';
import { triggerBrowserDownload } from '../../../utils/download';
import { toastUnlessHandled } from '../../../utils/apiError';
import { unitOptions } from '../../../utils/hrLabels';
import StrengthFilters from './strength/StrengthFilters';
import StrengthKpis from './strength/StrengthKpis';
import StrengthUnitBars from './strength/StrengthUnitBars';
import StrengthTable from './strength/StrengthTable';
import StrengthSummaryCard from './strength/StrengthSummaryCard';
import { COUNTING_NOTE } from './strength/strengthFormat';

const { Text } = Typography;
const ISO = 'YYYY-MM-DD';
const lastThirtyDays = (day) => [day.subtract(29, 'day'), day];

/**
 * The daily strength report: who is on the roll, who turned up, and where the gaps
 * are - by unit, department and designation, as the factory's own daily sheet has it.
 *
 * Everything is counted by the server on each change; the Excel, PDF and print are
 * the same report rebuilt there, so a file can never disagree with the screen.
 * Contractor rows appear only when the server says the viewer is the administrator.
 */
const StrengthReport = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { activeBranchId } = useBranch();
  const initial = useUrlFilters(['date', 'unitId', 'focus'], { numeric: ['unitId'] });

  const [date, setDate] = useState(() => (initial.date && dayjs(initial.date).isValid() ? dayjs(initial.date) : dayjs()));
  const [unitId, setUnitId] = useState(initial.unitId);
  const [joined, setJoined] = useState(() => lastThirtyDays(date));
  const [joinedTouched, setJoinedTouched] = useState(false);
  const [focus, setFocus] = useState(initial.focus ?? 'Tailor');
  const [units, setUnits] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined, { silent: true }).then(setUnits).catch(() => setUnits([]));
  }, [activeBranchId]);

  const params = useMemo(() => ({
    date: date.format(ISO),
    unitId: unitId ?? undefined,
    joinedFrom: joined[0].format(ISO),
    joinedTo: joined[1].format(ISO),
    focus,
  }), [date, unitId, joined, focus]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getStrengthReport(params)
      .then((loaded) => { if (!ignore) setReport(loaded); })
      .catch((e) => { if (!ignore) toastUnlessHandled(message, e, 'Could not load the strength report'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [params, message]);

  /** A new day moves the joiner window with it, until somebody has chosen their own. */
  const onDate = useCallback((next) => {
    setDate(next);
    if (!joinedTouched) setJoined(lastThirtyDays(next));
  }, [joinedTouched]);

  const onJoined = useCallback((range) => { setJoined(range); setJoinedTouched(true); }, []);

  const fetchFile = useCallback(async (format, label) => {
    setBusy(label);
    try {
      return await exportStrengthReport(params, format);
    } catch (e) {
      toastUnlessHandled(message, e, `Could not build the ${format === 'PDF' ? 'PDF' : 'Excel file'}`);
      return null;
    } finally {
      setBusy(null);
    }
  }, [params, message]);

  const onExport = useCallback(async (format) => {
    const blob = await fetchFile(format, format);
    if (blob) triggerBrowserDownload(blob, `Strength_${params.date}.${format === 'PDF' ? 'pdf' : 'xlsx'}`);
  }, [fetchFile, params.date]);

  /** Print is the PDF opened in a tab - the one layout that prints the same on every browser. */
  const onPrint = useCallback(async () => {
    const blob = await fetchFile('PDF', 'PRINT');
    if (!blob) return;
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const opened = window.open(url, '_blank');
    if (!opened) message.warning('Your browser blocked the new tab - allow pop-ups for this site, or use the PDF button.');
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }, [fetchFile, message]);

  const focusOptions = useMemo(() => {
    const names = new Set(report?.designationNames ?? []);
    names.add(focus);
    return [...names].map((n) => ({ value: n, label: n }));
  }, [report, focus]);

  const notMarked = report?.total?.notMarked ?? 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Daily Strength Report"
        subtitle={`On roll, present and absent - ${date.format('dddd, DD MMM YYYY')}`}
        onBack={() => navigate('/hr/attendance/calendar')}
      />

      <StrengthFilters
        date={date}
        onDate={onDate}
        unitId={unitId}
        onUnit={setUnitId}
        unitOptions={unitOptions(units)}
        joined={joined}
        onJoined={onJoined}
        focus={focus}
        onFocus={setFocus}
        focusOptions={focusOptions}
        onExport={onExport}
        onPrint={onPrint}
        busy={busy}
        disabled={!report || loading}
      />

      {!loading && notMarked > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${notMarked} ${notMarked === 1 ? 'person has' : 'people have'} no attendance marked for this day`}
          description="Until they are marked, Present, Absent and Absent % are not final."
          action={<Button size="small" onClick={() => navigate('/hr/attendance/bulk')}>Mark attendance</Button>}
        />
      )}

      <StrengthKpis total={report?.total} loading={loading && !report} />

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={24} xl={8}>
          <StrengthUnitBars units={report?.units ?? []} loading={loading && !report} />
        </Col>
        <Col xs={24} xl={16}>
          <StrengthSummaryCard
            title={`${focus} strength - unit-wise`}
            summary={report?.focus}
            report={report}
            labelTitle="Unit / Group"
            loading={loading}
          />
        </Col>
      </Row>

      <StrengthTable report={report} loading={loading} />

      {report?.contractLabour && (
        <div style={{ marginBottom: 16 }}>
          <StrengthSummaryCard
            title="Contract labour - by contractor"
            extra={<Tag icon={<LockOutlined />} color="purple">Visible to administrator only</Tag>}
            summary={report.contractLabour}
            report={report}
            labelTitle="Contractor"
            withNewJoiners
            loading={loading}
          />
        </div>
      )}

      <Text type="secondary" style={{ fontSize: 12 }}>{COUNTING_NOTE}</Text>
    </div>
  );
};

export default StrengthReport;
