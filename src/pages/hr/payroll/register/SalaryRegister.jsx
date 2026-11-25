import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, InputNumber, Button, Table, Statistic, Alert, Empty, Spin, Typography,
} from 'antd';
import { ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { getSalaryRegister, exportSalaryRegister } from '../../../../services/hr/salaryRegisterService';
import { getActiveUnits } from '../../../../services/master/unitService';
import { useBranch } from '../../../../context/BranchContext';
import { unitOptions } from '../../../../utils/hrLabels';
import { hasPermission } from '../../../../utils/permissions';
import { triggerBrowserDownload } from '../../../../utils/download';
import { toastUnlessHandled } from '../../../../utils/apiError';
import PageHeader from '../../../../components/PageHeader';
import { salaryRegisterColumns, leafColumns, registerMoney, registerDays } from './salaryRegisterColumns';

const { Text } = Typography;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((label, i) => ({ value: i + 1, label }));

/** Columns whose total is a count of days rather than an amount of money. */
const DAY_KEYS = new Set([
  'presentDays', 'weeklyOffDays', 'clDays', 'elDays',
  'payableDays', 'otHours', 'nhDays', 'lopDays',
]);

/**
 * A month's salary register: every employee paid, every figure that was paid them.
 *
 * The register was kept by hand in a workbook - 278 employees and fifty columns, one
 * sheet a month, J1 and B1 together. Everything in it was already in the database; what
 * was missing was a way to read a month across everybody at once instead of one payslip
 * or one run summary at a time.
 *
 * Nothing here is recalculated. Every money column is the figure payroll stored, which
 * is the figure on the payslip the employee was handed - a register that works the wage
 * out again can disagree with the payslips, and then there are two answers and no way
 * to say which is the company's.
 *
 * The download is built on the server from the same query, so the file somebody files
 * and the screen they checked cannot drift apart.
 */
const SalaryRegister = () => {
  const { message } = App.useApp();
  const { activeBranchId } = useBranch();
  const canView = hasPermission('hr-payroll', 'view');

  const now = new Date();
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined).then(setUnits).catch(() => setUnits([]));
  }, [activeBranchId]);

  const params = useMemo(
    () => ({ year, month, ...(unitId ? { unitId } : {}) }),
    [year, month, unitId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSalaryRegister(params));
    } catch (e) {
      setData(null);
      toastUnlessHandled(message, e, 'Could not load the register');
    } finally {
      setLoading(false);
    }
  }, [params, message]);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await exportSalaryRegister(params);
      const unit = data?.unitNames?.length ? ` - ${data.unitNames.join(' & ')}` : '';
      triggerBrowserDownload(blob, `Salary Register - ${MONTHS[month - 1].label} ${year}${unit}.xlsx`);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not build the workbook');
    } finally {
      setDownloading(false);
    }
  }, [params, data, month, year, message]);

  const columns = useMemo(() => salaryRegisterColumns(), []);
  const leaves = useMemo(() => leafColumns(columns), [columns]);

  /**
   * The TOTAL row, built from the leaf columns so it cannot drift out of step with
   * them: a column added above appears here in the right place or not at all, never
   * one cell to the left of the figures it is meant to foot.
   */
  const summary = useCallback(() => {
    const totals = data?.totals;
    if (!totals) return null;
    return (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ fontWeight: 600, background: 'var(--table-total-bg, #f0f5ff)' }}>
          {leaves.map((col, index) => {
            const value = totals[col.key];
            if (index === 0) {
              return <Table.Summary.Cell key={col.key} index={index}>TOTAL</Table.Summary.Cell>;
            }
            if (value == null) {
              return <Table.Summary.Cell key={col.key} index={index} />;
            }
            return (
              <Table.Summary.Cell key={col.key} index={index} align="right">
                {DAY_KEYS.has(col.key) ? registerDays(value) : registerMoney(value)}
              </Table.Summary.Cell>
            );
          })}
        </Table.Summary.Row>
      </Table.Summary>
    );
  }, [data, leaves]);

  const hasRows = (data?.rows?.length ?? 0) > 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Salary Register"
        subtitle="A month's payroll across every employee, as the register reads"
      >
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          loading={downloading}
          disabled={!hasRows}
          onClick={download}
        >
          Download Excel
        </Button>
      </PageHeader>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={12} sm={8} md={5}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Month</Text></div>
            <Select style={{ width: '100%' }} value={month} onChange={setMonth} options={MONTHS} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Year</Text></div>
            <InputNumber style={{ width: '100%' }} value={year} onChange={setYear} min={2020} max={2099} />
          </Col>
          <Col xs={24} sm={10} md={6}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Unit</Text></div>
            {/* Blank spans every unit that ran the month, which is how the workbook
                this replaces covered J1 and B1 on one sheet. */}
            <Select
              style={{ width: '100%' }}
              value={unitId}
              onChange={setUnitId}
              options={unitOptions(units)}
              placeholder="All units"
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} md={5}>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} disabled={!canView}>
              Load
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {!data && (
          <Card size="small">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Choose a month, then load." />
          </Card>
        )}

        {data && !hasRows && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title={`No payroll has been run for ${MONTHS[month - 1].label} ${year}`}
            description={unitId
              ? 'That unit has no run for this month. Clear the unit to see whether another one does.'
              : 'Nothing was processed for any unit that month, so there is nothing to register yet.'}
          />
        )}

        {data && hasRows && (
          <>
            {/* A run that is not approved can still move. The register shows it rather
                than leaving a gap nobody can account for, and says so rather than
                letting a draft figure be filed as final. */}
            {data.anyDraft && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="This register includes a payroll run that is not approved yet"
                description="Those figures can still change. Approve the run before filing this or paying from it."
              />
            )}

            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Employees" value={data.totals.employees} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Earnings" value={data.totals.totalEarnings ?? 0} prefix="₹" precision={0} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic title="Deductions" value={data.totals.totalDeductions ?? 0} prefix="₹" precision={0} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="Net Payable"
                    value={data.totals.netPayable ?? 0}
                    prefix="₹"
                    precision={0}
                    styles={{ content: { fontWeight: 600 } }}
                  />
                </Col>
                <Col xs={24} md={4}>
                  <div style={{ marginBottom: 4 }}><Text type="secondary">Units</Text></div>
                  <Text strong>{data.unitNames.join(' / ') || '-'}</Text>
                </Col>
              </Row>
            </Card>

            <Card size="small">
              <Table
                columns={columns}
                dataSource={data.rows}
                rowKey={(r) => r.salaryRecordId ?? r.serial}
                size="small"
                bordered
                pagination={false}
                scroll={{ x: 'max-content', y: 560 }}
                summary={summary}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
};

export default SalaryRegister;
