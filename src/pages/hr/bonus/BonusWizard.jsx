import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Steps, Button, Card, Select, InputNumber, Table, Row, Col, Statistic, Space, Spin, DatePicker } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { processBonus, approveBonus, getBonusRecords } from '../../../services/hr/bonusService';
import { getActiveFactories } from '../../../services/master/factoryService';
import PageHeader from '../../../components/PageHeader';

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const BonusWizard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [yearFrom, setYearFrom] = useState(null);
  const [yearTo, setYearTo] = useState(null);
  const [bonusPercentage, setBonusPercentage] = useState(8.33);
  const [runData, setRunData] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => message.error('Failed to load factories'));
  }, [message]);

  // Step 1 - Calculate Bonus
  const handleCalculate = useCallback(async () => {
    if (!factoryId) { message.warning('Please select a factory'); return; }
    if (!yearFrom || !yearTo) { message.warning('Please select year period'); return; }
    setLoading(true);
    try {
      const result = await processBonus({
        factoryId,
        yearFrom: yearFrom.format('YYYY-MM-DD'),
        yearTo: yearTo.format('YYYY-MM-DD'),
        bonusPercentage,
      });
      setRunData(result);
      const recs = await getBonusRecords(result.id);
      setRecords(Array.isArray(recs) ? recs : recs?.content || []);
      setCurrent(1);
      message.success('Bonus calculated successfully');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to calculate bonus');
    } finally {
      setLoading(false);
    }
  }, [factoryId, yearFrom, yearTo, bonusPercentage, message]);

  // Step 2 - Approve
  const handleApprove = useCallback(async () => {
    if (!runData?.id) return;
    setLoading(true);
    try {
      await approveBonus(runData.id);
      message.success('Bonus run approved');
      setCurrent(2);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve bonus');
    } finally {
      setLoading(false);
    }
  }, [runData, message]);

  const recordColumns = useMemo(
    () => [
      { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 200, ellipsis: true },
      { title: 'Employee Code', dataIndex: 'employeeCode', key: 'employeeCode', width: 120 },
      { title: 'Total Salary', dataIndex: 'totalSalary', key: 'totalSalary', width: 140, align: 'right', render: formatCurrency },
      { title: 'Bonus Amount', dataIndex: 'bonusAmount', key: 'bonusAmount', width: 140, align: 'right', render: formatCurrency },
    ],
    [],
  );

  const steps = [
    { title: 'Select Parameters' },
    { title: 'Review & Approve' },
    { title: 'Complete' },
  ];

  const totalBonusAmount = useMemo(
    () => records.reduce((sum, r) => sum + (r.bonusAmount || 0), 0),
    [records],
  );

  return (
    <>
      <PageHeader title="New Bonus Run" onBack={() => navigate('/hr/bonus')} />
      <Card>
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

        {/* Step 0: Select Parameters */}
        {current === 0 && (
          <Spin spinning={loading}>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Factory</div>
                <Select
                  placeholder="Select factory"
                  value={factoryId}
                  onChange={setFactoryId}
                  options={factories.map((f) => ({ value: f.id, label: f.name }))}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Year From</div>
                <DatePicker
                  value={yearFrom}
                  onChange={setYearFrom}
                  style={{ width: '100%' }}
                  placeholder="Select start date"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Year To</div>
                <DatePicker
                  value={yearTo}
                  onChange={setYearTo}
                  style={{ width: '100%' }}
                  placeholder="Select end date"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Bonus %</div>
                <InputNumber
                  value={bonusPercentage}
                  onChange={setBonusPercentage}
                  min={0}
                  max={100}
                  precision={2}
                  addonAfter="%"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleCalculate} loading={loading}>
                Calculate Bonus
              </Button>
            </div>
          </Spin>
        )}

        {/* Step 1: Review & Approve */}
        {current === 1 && (
          <Spin spinning={loading}>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={8}>
                <Statistic title="Employees" value={records.length} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="Bonus %" value={runData?.bonusPercentage || bonusPercentage} suffix="%" />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="Total Bonus" value={totalBonusAmount} prefix="\u20B9" precision={2} />
              </Col>
            </Row>
            <Table
              rowKey="id"
              columns={recordColumns}
              dataSource={records}
              scroll={{ x: 600 }}
              pagination={{ pageSize: 15 }}
              size="small"
            />
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrent(0)}>
                Back
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove} loading={loading}>
                Approve
              </Button>
            </div>
          </Spin>
        )}

        {/* Step 2: Complete */}
        {current === 2 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <h3>Bonus Run Approved Successfully</h3>
            <p>Total bonus of {formatCurrency(totalBonusAmount)} for {records.length} employees has been approved.</p>
            <Button type="primary" onClick={() => navigate('/hr/bonus')} style={{ marginTop: 16 }}>
              Back to Bonus List
            </Button>
          </div>
        )}
      </Card>
    </>
  );
};

export default BonusWizard;
