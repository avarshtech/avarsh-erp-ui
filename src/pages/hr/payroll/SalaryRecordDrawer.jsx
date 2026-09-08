import { Drawer, Descriptions, Divider, Row, Col, Typography, Tag } from 'antd';

const { Text } = Typography;

const money = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const days = (val) => (val != null ? Number(val).toString() : '-');

/** A line that is only worth showing when it carries a value. */
const Line = ({ label, value, hint, strong, tone }) => (
  <Row justify="space-between" style={{ padding: '5px 0' }}>
    <Col>
      <Text strong={strong}>{label}</Text>
      {hint && <div><Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text></div>}
    </Col>
    <Col><Text strong={strong} type={tone}>{money(value)}</Text></Col>
  </Row>
);

/**
 * The full derivation behind one employee's line in a payroll run.
 *
 * The review table shows earnings, three deductions and net, which is enough to
 * spot that a number looks wrong and nothing like enough to say why. Every
 * figure needed to explain it - attendance, each component before and after
 * pro-rating, the wages each statutory deduction was computed on, and the
 * employer's own contributions - is already on the record and was going
 * unshown. Approving a run without them means approving figures nobody can
 * check.
 */
const SalaryRecordDrawer = ({ record, open, onClose }) => (
  <Drawer
    title={record ? `${record.employeeNo || ''} ${record.employeeName || ''}`.trim() : 'Salary Record'}
    open={open}
    onClose={onClose}
    width={520}
  >
    {record && (
      <>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Department">{record.departmentName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{record.designationName || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left" style={{ marginTop: 20 }}>Attendance</Divider>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Calendar days">{days(record.calendarDays)}</Descriptions.Item>
          <Descriptions.Item label="Present">{days(record.presentDays)}</Descriptions.Item>
          <Descriptions.Item label="Payable days">{days(record.payableDays)}</Descriptions.Item>
          <Descriptions.Item label="Loss of pay">{days(record.lopDays)}</Descriptions.Item>
          <Descriptions.Item label="OT hours">{days(record.otHours)}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">Earnings</Divider>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Each component is pro-rated by payable days over calendar days.
        </Text>
        <div style={{ marginTop: 8 }}>
          <Line label="Basic" value={record.earnedBasic} hint={`Full month ${money(record.fixedBasic)}`} />
          <Line label="DA" value={record.earnedDa} hint={`Full month ${money(record.fixedDa)}`} />
          <Line label="HRA" value={record.earnedHra} hint={`Full month ${money(record.fixedHra)}`} />
          <Line label="Conveyance" value={record.earnedCa} hint={`Full month ${money(record.fixedCa)}`} />
          <Line label="Washing" value={record.earnedWa} hint={`Full month ${money(record.fixedWa)}`} />
          <Line label="Other allowance" value={record.earnedOther} hint={`Full month ${money(record.fixedOther)}`} />
          <Divider dashed style={{ margin: '8px 0' }} />
          <Line label="Earned gross" value={record.earnedGross} strong />
          {Number(record.otAmount) > 0 && (
            <Line label="Overtime" value={record.otAmount} hint={`${days(record.otHours)} hours`} />
          )}
          {Number(record.incentive) > 0 && <Line label="Incentive" value={record.incentive} />}
          {Number(record.arrears) > 0 && <Line label="Arrears" value={record.arrears} />}
          <Divider dashed style={{ margin: '8px 0' }} />
          <Line label="Total earnings" value={record.totalEarnings} strong />
        </div>

        <Divider orientation="left">Deductions</Divider>
        <div>
          <Line
            label="PF (employee)"
            value={record.pfEmployee}
            hint={record.pfWages != null ? `12% of PF wages ${money(record.pfWages)}` : undefined}
          />
          <Line
            label="ESI (employee)"
            value={record.esiEmployee}
            hint={Number(record.esiWages) > 0
              ? `0.75% of ${money(record.esiWages)}`
              : 'Above the wage ceiling, so nothing is due'}
          />
          <Line label="Professional tax" value={record.professionalTax} hint="Slab amount, spread over the half year" />
          {Number(record.lwf) > 0 && <Line label="Labour welfare fund" value={record.lwf} />}
          {Number(record.tds) > 0 && <Line label="TDS" value={record.tds} />}
          {Number(record.loanRecovery) > 0 && <Line label="Loan recovery" value={record.loanRecovery} />}
          {Number(record.advanceRecovery) > 0 && <Line label="Advance recovery" value={record.advanceRecovery} />}
          {Number(record.otherDeductions) > 0 && <Line label="Other deductions" value={record.otherDeductions} />}
          <Divider dashed style={{ margin: '8px 0' }} />
          <Line label="Total deductions" value={record.totalDeductions} strong tone="danger" />
        </div>

        <Divider orientation="left">Net</Divider>
        <Line label="Net salary" value={record.netSalary} strong tone="success" />

        <Divider orientation="left">Employer contributions</Divider>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Paid by the company on top of the salary above, not deducted from it.
        </Text>
        <div style={{ marginTop: 8 }}>
          <Line label="PF (employer)" value={record.pfEmployer} />
          <Line label="ESI (employer)" value={record.esiEmployer} />
          <Divider dashed style={{ margin: '8px 0' }} />
          <Line
            label="Cost to company"
            value={(Number(record.totalEarnings) || 0)
              + (Number(record.pfEmployer) || 0)
              + (Number(record.esiEmployer) || 0)}
            strong
          />
        </div>

        {Number(record.lopDays) > 0 && (
          <div style={{ marginTop: 16 }}>
            <Tag color="warning">
              {days(record.lopDays)} day(s) of loss of pay reduced every pro-rated component.
            </Tag>
          </div>
        )}
      </>
    )}
  </Drawer>
);

export default SalaryRecordDrawer;
