import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Descriptions, Divider, Button, Spin, Typography } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSalarySlip } from '../../../services/hr/payrollService';

const { Title, Text } = Typography;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u20B90.00';

const EarningRow = ({ label, value }) => (
  <Row justify="space-between" style={{ padding: '4px 0' }}>
    <Col><Text>{label}</Text></Col>
    <Col><Text>{formatCurrency(value)}</Text></Col>
  </Row>
);

const DeductionRow = ({ label, value }) => (
  <Row justify="space-between" style={{ padding: '4px 0' }}>
    <Col><Text>{label}</Text></Col>
    <Col><Text type="danger">{formatCurrency(value)}</Text></Col>
  </Row>
);

const SalarySlipView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [slip, setSlip] = useState(null);

  const fetchSlip = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalarySlip(id);
      setSlip(result);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSlip();
  }, [fetchSlip]);

  const handlePrint = () => window.print();

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  if (!slip) return null;

  const monthYear = `${MONTH_NAMES[(slip.month || 1) - 1]} ${slip.year}`;

  return (
    <div className="salary-slip-print">
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }} className="no-print">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
      </div>

      <Card style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>{slip.factoryName || 'Avarsh Apparels'}</Title>
          <Text type="secondary">Salary Slip for {monthYear}</Text>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* Employee Details */}
        <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="Employee Name">{slip.employeeName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Employee No">{slip.employeeNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Department">{slip.departmentName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{slip.designationName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Payable Days">{slip.payableDays ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Loss of Pay Days">{slip.lopDays ?? 0}</Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }} />

        {/* Earnings & Deductions Two-Column */}
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <Title level={5}>Earnings</Title>
            {/*
              These read slip.basic, slip.da and so on, none of which exist on
              SalarySlipDTO - the API returns the earned_ figures, pro-rated for
              payable days. Every row in this column was therefore blank.
            */}
            <EarningRow label="Basic" value={slip.earnedBasic} />
            <EarningRow label="DA" value={slip.earnedDa} />
            <EarningRow label="HRA" value={slip.earnedHra} />
            <EarningRow label="Conveyance" value={slip.earnedCa} />
            <EarningRow label="Washing Allowance" value={slip.earnedWa} />
            <EarningRow label="Other Allowance" value={slip.earnedOther} />
            <EarningRow label="OT" value={slip.otAmount} />
            {Number(slip.incentive) > 0 && <EarningRow label="Incentive" value={slip.incentive} />}
            {Number(slip.arrears) > 0 && <EarningRow label="Arrears" value={slip.arrears} />}
            <Divider dashed style={{ margin: '8px 0' }} />
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Gross Salary</Text></Col>
              <Col><Text strong>{formatCurrency(slip.earnedGross)}</Text></Col>
            </Row>
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Total Earnings</Text></Col>
              <Col><Text strong>{formatCurrency(slip.totalEarnings)}</Text></Col>
            </Row>
          </Col>

          <Col xs={24} sm={12}>
            <Title level={5}>Deductions</Title>
            <DeductionRow label="PF" value={slip.pfEmployee} />
            <DeductionRow label="ESI" value={slip.esiEmployee} />
            <DeductionRow label="Professional Tax" value={slip.professionalTax} />
            <DeductionRow label="LWF" value={slip.lwf} />
            <DeductionRow label="Loan Recovery" value={slip.loanRecovery} />
            <DeductionRow label="Advance Recovery" value={slip.advanceRecovery} />
            <Divider dashed style={{ margin: '8px 0' }} />
            <DeductionRow label="TDS" value={slip.tds} />
            <DeductionRow label="Other Deductions" value={slip.otherDeductions} />
            <Divider dashed style={{ margin: '8px 0' }} />
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Total Deductions</Text></Col>
              <Col><Text strong type="danger">{formatCurrency(slip.totalDeductions)}</Text></Col>
            </Row>
          </Col>
        </Row>

        {/*
          Employer contributions are computed and stored per record but have
          never been shown, so the cost of employment was invisible to the
          employee. They are not deducted from pay, which the heading says.
        */}
        <Divider style={{ margin: '16px 0' }} />
        <Title level={5}>Employer Contributions (not deducted from your pay)</Title>
        <Row gutter={24}>
          <Col xs={24} sm={12}>
            <EarningRow label="PF (Employer)" value={slip.pfEmployer} />
            <EarningRow label="ESI (Employer)" value={slip.esiEmployer} />
          </Col>
          <Col xs={24} sm={12}>
            <Divider dashed style={{ margin: '8px 0' }} />
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Cost to Company</Text></Col>
              <Col>
                <Text strong>
                  {formatCurrency(
                    (Number(slip.totalEarnings) || 0)
                    + (Number(slip.pfEmployer) || 0)
                    + (Number(slip.esiEmployer) || 0),
                  )}
                </Text>
              </Col>
            </Row>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* Net Salary */}
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Text type="secondary" style={{ fontSize: 14 }}>Net Salary</Text>
          <div>
            <Title level={3} style={{ margin: 0, color: '#3f8600' }}>
              {formatCurrency(slip.netSalary)}
            </Title>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SalarySlipView;
