import { useState, useEffect, useCallback } from 'react';
import { App, Card, Row, Col, Descriptions, Divider, Button, Spin, Typography } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSalarySlip } from '../../../services/payrollService';

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
  const { message } = App.useApp();
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
      message.error('Failed to load salary slip');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

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
          <Title level={4} style={{ margin: 0 }}>{slip.companyName || 'Avarsh Apparels'}</Title>
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
            <EarningRow label="Basic" value={slip.basic} />
            <EarningRow label="DA" value={slip.da} />
            <EarningRow label="HRA" value={slip.hra} />
            <EarningRow label="Conveyance" value={slip.conveyance} />
            <EarningRow label="Washing Allowance" value={slip.washingAllowance} />
            <EarningRow label="OT" value={slip.otAmount} />
            <Divider dashed style={{ margin: '8px 0' }} />
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Gross Salary</Text></Col>
              <Col><Text strong>{formatCurrency(slip.grossSalary)}</Text></Col>
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
            <Row justify="space-between" style={{ padding: '4px 0' }}>
              <Col><Text strong>Total Deductions</Text></Col>
              <Col><Text strong type="danger">{formatCurrency(slip.totalDeductions)}</Text></Col>
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
