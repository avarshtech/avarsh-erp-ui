import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Steps, Button, Card, Select, InputNumber, Table, Row, Col, Statistic, Space, Spin, Alert } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { processBonus, approveBonus, getBonusRecords } from '../../../services/hr/bonusService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { factoryOptions } from '../../../utils/hrLabels';
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
  // The API takes the accounting year as two integers: April of yearFrom to
  // March of yearTo. yearTo is therefore always yearFrom + 1, so only the start
  // year is asked for and the pair is derived.
  const [yearFrom, setYearFrom] = useState(new Date().getMonth() + 1 >= 4
    ? new Date().getFullYear()
    : new Date().getFullYear() - 1);
  const [bonusPercentage, setBonusPercentage] = useState(8.33);
  // The statutory band. A rate outside it cannot be paid, so the wizard
  // will not carry it forward to a calculation the server would refuse.
  const outOfBand = bonusPercentage == null || bonusPercentage < 8.33 || bonusPercentage > 20;
  const [runData, setRunData] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => message.error('Failed to load factories'));
  }, [message]);

  // Step 1 - Calculate Bonus
  const handleCalculate = useCallback(async () => {
    if (!factoryId) { message.warning('Please select a factory'); return; }
    if (!yearFrom) { message.warning('Please select the accounting year'); return; }
    setLoading(true);
    try {
      const result = await processBonus({
        factoryId,
        // Integers, not dates. Sending "2026-08-01" produced
        // "Cannot deserialize value of type Integer from String".
        yearFrom,
        yearTo: yearFrom + 1,
        // The request field is `percentage`; sending `bonusPercentage` left it
        // null and the server silently fell back to the 8.33% statutory minimum.
        percentage: bonusPercentage,
      });
      setRunData(result);
      const recs = await getBonusRecords(result.id);
      setRecords(Array.isArray(recs) ? recs : recs?.content || []);
      setCurrent(1);
      message.success('Bonus calculated successfully');
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [factoryId, yearFrom, bonusPercentage, message]);

  // Step 2 - Approve
  const handleApprove = useCallback(async () => {
    if (!runData?.id) return;
    setLoading(true);
    try {
      await approveBonus(runData.id);
      message.success('Bonus run approved');
      setCurrent(2);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [runData, message]);

  const recordColumns = useMemo(
    () => [
      { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 200, ellipsis: true },
      { title: 'Employee Code', dataIndex: 'employeeNo', key: 'employeeNo', width: 120 },
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
                  options={factoryOptions(factories)}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Accounting Year</div>
                <Select
                  value={yearFrom}
                  onChange={setYearFrom}
                  style={{ width: '100%' }}
                  options={Array.from({ length: 6 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return { value: y, label: `${y}-${String(y + 1).slice(2)} (Apr ${y} to Mar ${y + 1})` };
                  })}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Bonus %</div>
                {/*
                  0 to 100 let anything through - 55% was accepted, and so was 2%.
                  The Payment of Bonus Act sets the rate between 8.33% and 20%,
                  and the server refuses outside it, so the input should not
                  invite a number that cannot be paid.
                */}
                <InputNumber
                  value={bonusPercentage}
                  onChange={setBonusPercentage}
                  min={8.33}
                  max={20}
                  step={0.01}
                  precision={2}
                  addonAfter="%"
                  status={outOfBand ? 'error' : undefined}
                  style={{ width: '100%' }}
                />
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {outOfBand
                    ? <span style={{ color: 'var(--error-color, #ff4d4f)' }}>
                        Must be between 8.33% and 20%
                      </span>
                    : <span style={{ color: 'rgba(0,0,0,0.45)' }}>
                        8.33% is the statutory minimum, 20% the maximum
                      </span>}
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleCalculate} loading={loading} disabled={outOfBand}>
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
                <Statistic title="Total Bonus" value={totalBonusAmount} prefix={'\u20B9'} precision={2} />
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
