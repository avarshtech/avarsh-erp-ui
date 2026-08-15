import { useState, useCallback, useMemo } from 'react';
import { App, Card, Form, Select, DatePicker, Button, InputNumber, Row, Col, Divider, Spin, Descriptions, Tag } from 'antd';
import { CalculatorOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { calculateFnf, approveFnf } from '../../../services/hr/fnfService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { SEPARATION_REASONS, FNF_STATUS } from '../../../utils/hrConstants';
import { employeeOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const FnfForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [fnfData, setFnfData] = useState(null);

  const handleEmployeeSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setSearchLoading(true);
    try {
      const result = await searchEmployees({ search, size: 20 });
      const list = Array.isArray(result) ? result : result?.content || [];
      setEmployees(list);
    } catch {
      // silent
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleCalculate = useCallback(async () => {
    try {
      const values = await form.validateFields(['employeeId', 'lastWorkingDate', 'separationReason']);
      setLoading(true);
      const result = await calculateFnf({
        employeeId: values.employeeId,
        lastWorkingDate: values.lastWorkingDate.format('YYYY-MM-DD'),
        separationReason: values.separationReason,
      });
      setFnfData(result);
      // Populate override fields with calculated values
      form.setFieldsValue({
        pendingSalary: result.pendingSalary,
        elEncashment: result.elEncashment,
        bonusProRata: result.bonusProRata,
        gratuity: result.gratuity,
        otherEarnings: result.otherEarnings || 0,
        outstandingLoan: result.outstandingLoan,
        outstandingAdvance: result.outstandingAdvance,
        noticePeriodRecovery: result.noticePeriodRecovery,
        otherDeductions: result.otherDeductions || 0,
      });
      message.success('F&F calculated successfully');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to calculate F&F');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  const handleApprove = useCallback(async () => {
    if (!fnfData?.id) return;
    setLoading(true);
    try {
      await approveFnf(fnfData.id);
      message.success('F&F settlement approved');
      navigate(`/hr/fnf/${fnfData.id}`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve F&F');
    } finally {
      setLoading(false);
    }
  }, [fnfData, message, navigate]);

  // Watch earnings/deductions for net calculation
  const pendingSalary = Form.useWatch('pendingSalary', form) || 0;
  const elEncashment = Form.useWatch('elEncashment', form) || 0;
  const bonusProRata = Form.useWatch('bonusProRata', form) || 0;
  const gratuity = Form.useWatch('gratuity', form) || 0;
  const otherEarnings = Form.useWatch('otherEarnings', form) || 0;
  const outstandingLoan = Form.useWatch('outstandingLoan', form) || 0;
  const outstandingAdvance = Form.useWatch('outstandingAdvance', form) || 0;
  const noticePeriodRecovery = Form.useWatch('noticePeriodRecovery', form) || 0;
  const otherDeductions = Form.useWatch('otherDeductions', form) || 0;

  const totalEarnings = pendingSalary + elEncashment + bonusProRata + gratuity + otherEarnings;
  const totalDeductions = outstandingLoan + outstandingAdvance + noticePeriodRecovery + otherDeductions;
  const netSettlement = totalEarnings - totalDeductions;

  const isCalculated = fnfData?.status === 'CALCULATED';

  return (
    <>
      <PageHeader title="New F&F Settlement" onBack={() => navigate('/hr/fnf')} />
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Card title="Employee Details" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Please select an employee' }]}>
                  <Select
                    showSearch
                    placeholder="Search employee by name or code"
                    filterOption={false}
                    onSearch={handleEmployeeSearch}
                    loading={searchLoading}
                    options={employeeOptions(employees)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="lastWorkingDate" label="Last Working Date" rules={[{ required: true, message: 'Required' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="separationReason" label="Separation Reason" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select reason" options={SEPARATION_REASONS} />
                </Form.Item>
              </Col>
            </Row>
            {!fnfData && (
              <div style={{ textAlign: 'right' }}>
                <Button type="primary" icon={<CalculatorOutlined />} onClick={handleCalculate} loading={loading}>
                  Calculate
                </Button>
              </div>
            )}
          </Card>

          {fnfData && (
            <>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card title="Earnings" style={{ marginBottom: 16 }}>
                    <Form.Item name="pendingSalary" label="Pending Salary">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="elEncashment" label="EL Encashment">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="bonusProRata" label="Bonus Pro-rata">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="gratuity" label="Gratuity">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="otherEarnings" label="Other Earnings">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Divider />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Total Earnings</span>
                      <span style={{ color: '#52c41a' }}>{formatCurrency(totalEarnings)}</span>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Deductions" style={{ marginBottom: 16 }}>
                    <Form.Item name="outstandingLoan" label="Outstanding Loan">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="outstandingAdvance" label="Outstanding Advance">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="noticePeriodRecovery" label="Notice Period Recovery">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Form.Item name="otherDeductions" label="Other Deductions">
                      <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="\u20B9" />
                    </Form.Item>
                    <Divider />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Total Deductions</span>
                      <span style={{ color: '#ff4d4f' }}>{formatCurrency(totalDeductions)}</span>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 0' }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>
                    Net Settlement: <span style={{ color: netSettlement >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatCurrency(netSettlement)}</span>
                  </span>
                </div>
              </Card>

              {isCalculated && (
                <div style={{ textAlign: 'right' }}>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove} loading={loading} size="large">
                    Approve F&F Settlement
                  </Button>
                </div>
              )}
            </>
          )}
        </Form>
      </Spin>
    </>
  );
};

export default FnfForm;
