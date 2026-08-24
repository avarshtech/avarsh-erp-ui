import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, InputNumber, Button, Table, Statistic,
  Space, Alert, Tag, Spin, Empty, Typography,
} from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getPfSummary, getEsiSummary, downloadEcrFile, downloadEsiFile,
} from '../../../services/hr/statutoryFilingService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { triggerBrowserDownload } from '../../../services/hr/attendanceService';
import { factoryOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const { Text } = Typography;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: i + 1, label }));

const formatCurrency = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

/**
 * PF and ESI monthly filing.
 *
 * Every figure comes from the payroll run for the period - nothing is
 * recalculated here. The point of the screen is to check the totals against the
 * challan before filing, and to surface the employees whose identifiers are
 * missing, since one of those rejects the whole return.
 *
 * `scheme` is 'PF' or 'ESI'; the two differ only in wording and the EPS column.
 */
const ContributionFiling = ({ scheme = 'PF' }) => {
  const { message } = App.useApp();
  const isPf = scheme === 'PF';
  const canView = hasPermission('hr-statutory', 'view');

  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!factoryId) { message.warning('Select a factory first'); return; }
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const data = isPf
        ? await getPfSummary(factoryId, month, year)
        : await getEsiSummary(factoryId, month, year);
      setSummary(data);
    } catch (err) {
      setError(err?.response?.data?.message || `Could not load the ${scheme} summary`);
    } finally {
      setLoading(false);
    }
  }, [factoryId, month, year, isPf, scheme, message]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = isPf
        ? await downloadEcrFile(factoryId, month, year)
        : await downloadEsiFile(factoryId, month, year);
      const name = isPf
        ? `ECR_${factoryId}_${String(month).padStart(2, '0')}_${year}.txt`
        : `ESI_${factoryId}_${String(month).padStart(2, '0')}_${year}.csv`;
      triggerBrowserDownload(blob, name);
      message.success(`${isPf ? 'ECR' : 'ESI contribution'} file downloaded`);
    } catch (err) {
      // The server refuses to produce a file that the portal would reject, and
      // says exactly why. A blob response has to be read back as text.
      let msg = `Could not generate the ${scheme} file`;
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try { msg = JSON.parse(await data.text())?.message || msg; } catch { /* keep default */ }
      } else if (data?.message) {
        msg = data.message;
      }
      message.error(msg);
    } finally {
      setDownloading(false);
    }
  }, [factoryId, month, year, isPf, scheme, message]);

  const columns = useMemo(() => {
    const base = [
      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 110 },
      { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 180, ellipsis: true },
      {
        title: isPf ? 'UAN' : 'IP Number', dataIndex: 'identifier', key: 'identifier', width: 150,
        render: (v) => (v ? v : <Tag color="error">missing</Tag>),
      },
      { title: 'Wages', dataIndex: 'wages', key: 'wages', width: 130, align: 'right', render: formatCurrency },
      { title: 'Employee', dataIndex: 'employeeShare', key: 'employeeShare', width: 120, align: 'right', render: formatCurrency },
      { title: 'Employer', dataIndex: 'employerShare', key: 'employerShare', width: 120, align: 'right', render: formatCurrency },
    ];
    if (isPf) {
      base.push({
        title: 'of which EPS', dataIndex: 'epsShare', key: 'epsShare',
        width: 130, align: 'right', render: formatCurrency,
      });
      base.push({
        title: 'NCP Days', dataIndex: 'nonContributingDays', key: 'nonContributingDays',
        width: 100, align: 'right',
      });
    }
    return base;
  }, [isPf]);

  const blocked = summary && (summary.missingIdentifiers?.length > 0
    || !['APPROVED', 'PAID'].includes(summary.payrollStatus));

  return (
    <>
      <PageHeader
        title={isPf ? 'PF — Monthly ECR' : 'ESI — Monthly Contribution'}
        subtitle={isPf
          ? 'Figures come from the payroll run. Download the ECR for the EPFO portal.'
          : 'Figures come from the payroll run. Download the contribution file for the ESIC portal.'}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={8} md={6}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Factory</Text></div>
            <Select
              placeholder="Select factory"
              style={{ width: '100%' }}
              value={factoryId}
              onChange={setFactoryId}
              options={factoryOptions(factories)}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Month</Text></div>
            <Select style={{ width: '100%' }} value={month} onChange={setMonth} options={MONTHS} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Year</Text></div>
            <InputNumber style={{ width: '100%' }} value={year} onChange={setYear} min={2020} max={2099} />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading} disabled={!factoryId || !canView}>
                Load Summary
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                loading={downloading}
                disabled={!summary || blocked}
              >
                {isPf ? 'Download ECR' : 'Download Contribution File'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />}

      <Spin spinning={loading}>
        {!summary && !error && (
          <Card size="small">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Choose a factory and period, then load the summary."
            />
          </Card>
        )}

        {summary && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={4}>
                  <Statistic title="Employees" value={summary.contributingEmployees} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title={isPf ? 'PF Wages' : 'ESI Wages'} value={summary.totalWages ?? 0} prefix="₹" precision={2} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Employee Share" value={summary.employeeContribution ?? 0} prefix="₹" precision={2} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Employer Share" value={summary.employerContribution ?? 0} prefix="₹" precision={2} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="Total Payable"
                    value={summary.totalContribution ?? 0}
                    prefix="₹"
                    precision={2}
                    valueStyle={{ fontWeight: 600 }}
                  />
                </Col>
              </Row>

              {isPf && (
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col xs={12} sm={8}>
                    <Statistic title="of which EPS (pension)" value={summary.epsContribution ?? 0} prefix="₹" precision={2} />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic title="of which EPF (employer)" value={summary.epfEmployerContribution ?? 0} prefix="₹" precision={2} />
                  </Col>
                </Row>
              )}
            </Card>

            {/* Anything that would make the portal reject the return. */}
            {summary.missingIdentifiers?.length > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${summary.missingIdentifiers.length} employee(s) have no ${isPf ? 'UAN' : 'ESI number'}`}
                description={
                  <>
                    <div style={{ marginBottom: 8 }}>
                      The portal rejects a return containing them. Add the number on the employee
                      record, then reload.
                    </div>
                    <Space wrap size={[8, 8]}>
                      {summary.missingIdentifiers.map((m) => (
                        <Tag key={m.employeeNo} color="error">{m.employeeNo} — {m.employeeName}</Tag>
                      ))}
                    </Space>
                  </>
                }
              />
            )}

            {!['APPROVED', 'PAID'].includes(summary.payrollStatus) && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`The payroll run for this period is ${summary.payrollStatus}`}
                description="Approve it before filing, or the figures you submit may not match what is paid."
              />
            )}

            <Card size="small" title={`Contribution Lines (${summary.contributingEmployees})`}>
              <Table
                rowKey="employeeId"
                dataSource={summary.lines}
                columns={columns}
                size="small"
                scroll={{ x: isPf ? 1100 : 900 }}
                pagination={{ pageSize: 25, showSizeChanger: true }}
                locale={{
                  emptyText: `No contributing employees this month. ${isPf
                    ? 'PF applies only to employees flagged for it.'
                    : 'ESI applies only below the wage ceiling.'}`,
                }}
              />
            </Card>
          </>
        )}
      </Spin>
    </>
  );
};

export default ContributionFiling;
