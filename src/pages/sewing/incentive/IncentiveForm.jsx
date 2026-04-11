import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, DatePicker, Button, Card,
  Row, Col, Table, Skeleton, Select, Statistic,
} from 'antd';
import { SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createIncentive, getIncentiveById, approveIncentive, getAllActiveLines,
} from '../../../services/sewing/sewingService';
import { INCENTIVE_STATUS } from '../../../utils/sewingConstants';
import { formatPercentage, formatCurrency } from '../../../utils/formatters';

const { RangePicker } = DatePicker;

const IncentiveForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isView = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [record, setRecord] = useState(null);
  const [lineOptions, setLineOptions] = useState([]);
  const [operators, setOperators] = useState([]);

  // Load lines
  useEffect(() => {
    getAllActiveLines()
      .then((data) => {
        const lines = Array.isArray(data) ? data : (data?.content || []);
        setLineOptions(lines.map((l) => ({ value: l.id, label: l.lineCode || l.lineName })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (isView) {
      setLoading(true);
      getIncentiveById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            lineId: data.lineId,
            period: data.periodFrom && data.periodTo
              ? [dayjs(data.periodFrom), dayjs(data.periodTo)]
              : null,
          });
          setOperators(data.operators || []);
        })
        .catch(() => message.error('Failed to load incentive calculation'))
        .finally(() => setLoading(false));
    }
  }, [id, isView, form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const [periodFrom, periodTo] = values.period || [];
      const payload = {
        lineId: values.lineId,
        periodFrom: periodFrom?.format('YYYY-MM-DD'),
        periodTo: periodTo?.format('YYYY-MM-DD'),
      };
      await createIncentive(payload);
      message.success('Incentive calculation created');
      navigate('/sewing/incentive/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, navigate]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      await approveIncentive(id);
      message.success('Incentive calculation approved');
      navigate('/sewing/incentive/list');
    } catch {
      message.error('Approval failed');
    } finally {
      setApproving(false);
    }
  }, [id, navigate]);

  const totalIncentive = useMemo(
    () => operators.reduce((sum, op) => sum + (op.incentiveAmt || 0), 0),
    [operators],
  );

  const avgEfficiency = useMemo(() => {
    if (operators.length === 0) return 0;
    return operators.reduce((sum, op) => sum + (op.efficiencyPct || 0), 0) / operators.length;
  }, [operators]);

  const operatorColumns = useMemo(() => [
    { title: 'Operator', dataIndex: 'operatorName', key: 'operatorName', width: 180 },
    {
      title: 'Minutes Worked',
      dataIndex: 'minutesWorked',
      key: 'minutesWorked',
      width: 130,
      align: 'right',
    },
    {
      title: 'Efficiency %',
      dataIndex: 'efficiencyPct',
      key: 'efficiencyPct',
      width: 120,
      align: 'right',
      render: (val) => formatPercentage(val),
    },
    {
      title: 'Incentive Amount',
      dataIndex: 'incentiveAmt',
      key: 'incentiveAmt',
      width: 140,
      align: 'right',
      render: (val) => formatCurrency(val),
    },
  ], []);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const canApprove = isView && record?.status === INCENTIVE_STATUS.DRAFT;

  return (
    <>
      <PageHeader
        title={isView ? `Incentive: ${record?.calcNo || ''}` : 'New Incentive Calculation'}
        onBack={() => navigate('/sewing/incentive/list')}
      >
        {!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
        {canApprove && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={approving} onClick={handleApprove}>
            Approve
          </Button>
        )}
      </PageHeader>

      <Card title="Calculation Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isView}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="lineId" label="Sewing Line" rules={[{ required: true, message: 'Select a line' }]}>
                <Select options={lineOptions} placeholder="Select line" showSearch optionFilterProp="label" disabled={isView} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="period" label="Period" rules={[{ required: true, message: 'Select period' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {isView && operators.length > 0 && (
        <>
          <Card title="Summary" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={12} sm={6}>
                <Statistic title="Operators" value={operators.length} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Avg Efficiency" value={formatPercentage(avgEfficiency)} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Total Incentive" value={formatCurrency(totalIncentive)} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Status" value={record?.status || 'DRAFT'} />
              </Col>
            </Row>
          </Card>

          <Card title="Operator Breakdown">
            <Table
              rowKey="operatorId"
              columns={operatorColumns}
              dataSource={operators}
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} align="right"><strong>{formatCurrency(totalIncentive)}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </>
      )}
    </>
  );
};

export default IncentiveForm;
