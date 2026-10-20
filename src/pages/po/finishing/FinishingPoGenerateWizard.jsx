import { useState, useEffect, useCallback } from 'react';
import { App, Card, Steps, Form, Button, Space, Typography, Tag, Alert, Grid, InputNumber } from 'antd';
import { HomeOutlined, CarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { FormSelect, FormDatePicker, FormSection } from '../../../components/form';
import ProcessAssignmentTable from './ProcessAssignmentTable';
import PpSampleGate from '../components/PpSampleGate';
import { numericInputProps } from '../../../utils/inputHelpers';
import { FINISHING_PROCESSES, getProcessLabel, isPpApproved } from '../../../utils/productionConstants';
import {
  getConfirmedOrders, getPpApprovalStatus, getVendors,
} from '../../../services/po/production/productionLookupService';
import { getApprovedWorkOrders } from '../../../services/po/production/workOrderService';
import { generateFinishingPos } from '../../../services/po/production/finishingPoService';

const { Text, Title } = Typography;
const initAssignments = () => FINISHING_PROCESSES.map((p) => ({ processKey: p.key, mode: 'INHOUSE', vendorId: null }));

const FinishingPoGenerateWizard = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();

  const [step, setStep] = useState(0);
  const [orders, setOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [ppStatus, setPpStatus] = useState(null);
  const [assignments, setAssignments] = useState(initAssignments);
  // Rate / pc of each PO to be raised, keyed by group ('INHOUSE' or the vendor id) —
  // in-house work is paid per piece too, so every PO carries its price from the start.
  const [rates, setRates] = useState({});
  const [formData, setFormData] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => { getConfirmedOrders().then(setOrders); getVendors('FINISHING').then(setVendors); }, []);

  const handleOrderSelect = useCallback(async (orderId) => {
    form.setFieldValue('workOrderId', undefined);
    const [wos, pp] = await Promise.all([getApprovedWorkOrders(orderId), getPpApprovalStatus(orderId)]);
    setWorkOrders(wos); setPpStatus(pp);
  }, [form]);

  const computeGroups = useCallback(() => {
    const inhouse = assignments.filter((a) => a.mode === 'INHOUSE').map((a) => a.processKey);
    const byVendor = {};
    assignments.filter((a) => a.mode === 'OUTSOURCE' && a.vendorId).forEach((a) => {
      (byVendor[a.vendorId] = byVendor[a.vendorId] || []).push(a.processKey);
    });
    const groups = [];
    if (inhouse.length) groups.push({ key: 'INHOUSE', label: 'In-house', processes: inhouse });
    Object.entries(byVendor).forEach(([vid, procs]) =>
      groups.push({ key: vid, label: vendors.find((v) => v.id === Number(vid))?.name || 'Vendor', processes: procs }));
    return groups;
  }, [assignments, vendors]);

  const next = async () => {
    if (step === 0) {
      // Capture step-1 values now — the Form unmounts when we leave this step,
      // so reading it later via getFieldsValue() would return nothing.
      try { setFormData(await form.validateFields(['orderId', 'workOrderId', 'plannedStartDate', 'plannedEndDate'])); }
      catch { return; }
    }
    if (step === 1) {
      const badOutsource = assignments.some((a) => a.mode === 'OUTSOURCE' && !a.vendorId);
      if (badOutsource) return message.warning('Pick a vendor for every outsourced process');
    }
    setStep((s) => s + 1);
  };

  const generate = async () => {
    const wo = workOrders.find((w) => w.id === formData.workOrderId);
    if (!formData.orderId || !formData.workOrderId) {
      return message.error('Order / Work Order missing — go back to step 1 and reselect.');
    }
    setGenerating(true);
    try {
      const created = await generateFinishingPos({
        orderId: formData.orderId, workOrderId: formData.workOrderId, workOrderNo: wo?.workOrderNo,
        plannedStartDate: formData.plannedStartDate?.format('YYYY-MM-DD'), plannedEndDate: formData.plannedEndDate?.format('YYYY-MM-DD'),
        assignments,
        inhouseRatePerPiece: rates.INHOUSE ?? null,
        vendorRatePerPiece: Object.fromEntries(Object.entries(rates).filter(([k]) => k !== 'INHOUSE')),
      });
      message.success(`${created.length} Finishing PO(s) created`);
      navigate('/purchase-orders/finishing-po/list');
    } catch (e) {
      message.error(e.message || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const groups = computeGroups();
  const ppApproved = isPpApproved(ppStatus);
  const ratesMissing = groups.some((g) => !(rates[g.key] > 0));

  const steps = [
    { title: 'Order & Work Order', content: (
      <Form form={form} layout="vertical">
        {ppStatus && <PpSampleGate status={ppStatus} />}
        <FormSection title="Source" columns={2}>
          <Form.Item name="orderId" label="Confirmed Order" rules={[{ required: true, message: 'Select an order' }]}>
            <FormSelect placeholder="Select order" onChange={handleOrderSelect}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo} · ${o.buyer}` }))} />
          </Form.Item>
          <Form.Item name="workOrderId" label="Approved Work Order" rules={[{ required: true, message: 'Select a Work Order' }]}>
            <FormSelect placeholder="Select approved work order"
              options={workOrders.map((w) => ({ value: w.id, label: w.workOrderNo }))} />
          </Form.Item>
          <Form.Item name="plannedStartDate" label="Planned Start" rules={[{ required: true, message: 'Required' }]}><FormDatePicker /></Form.Item>
          <Form.Item name="plannedEndDate" label="Planned End" rules={[{ required: true, message: 'Required' }]}><FormDatePicker /></Form.Item>
        </FormSection>
      </Form>
    ) },
    { title: 'Assign Processes', content: (
      <ProcessAssignmentTable assignments={assignments} onChange={setAssignments} vendors={vendors} />
    ) },
    { title: 'Review & Confirm', content: (
      <div>
        <Title level={5}>{groups.length} Finishing PO{groups.length !== 1 ? 's' : ''} will be created</Title>
        {!ppApproved && <Alert type="warning" showIcon style={{ margin: '12px 0' }} title="PP Sample not approved — generation is blocked for this order." />}
        <Space orientation="vertical" style={{ width: '100%' }}>
          {groups.map((g, i) => (
            <Card key={i} size="small">
              <Space wrap>
                <Text strong>{g.label === 'In-house' ? <><HomeOutlined /> In-house</> : <><CarOutlined /> {g.label}</>}</Text>
                <Text type="secondary">→</Text>
                {g.processes.sort((a, b) => FINISHING_PROCESSES.find((p) => p.key === a).sequence - FINISHING_PROCESSES.find((p) => p.key === b).sequence)
                  .map((p) => <Tag key={p} color="blue">{getProcessLabel(p)}</Tag>)}
              </Space>
              <div style={{ marginTop: 10 }}>
                <Text strong>Rate / Pc <Text type="danger">*</Text></Text>{' '}
                <InputNumber
                  name={`rate-${g.key}`} aria-label={`Rate per piece — ${g.label}`}
                  min={0} precision={2} prefix="₹" placeholder="0.00" style={{ width: 160 }}
                  value={rates[g.key]} onChange={(v) => setRates((r) => ({ ...r, [g.key]: v }))}
                  status={rates[g.key] > 0 ? undefined : 'warning'} {...numericInputProps}
                />
              </div>
            </Card>
          ))}
        </Space>
      </div>
    ) },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Generate Finishing POs" backPath="/purchase-orders/finishing-po/list" />
      <Card>
        <Steps current={step} orientation={screens.md ? 'horizontal' : 'vertical'} items={steps.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />
        {steps[step].content}
        <Space style={{ marginTop: 24, justifyContent: 'flex-end', width: '100%' }}>
          {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Back</Button>}
          {step < 2 && <Button type="primary" onClick={next}>Next</Button>}
          {step === 2 && (
            <Button type="primary" loading={generating} disabled={!ppApproved || !groups.length || ratesMissing}
              title={ratesMissing ? 'Enter the Rate / Pc of every PO' : undefined} onClick={generate}>
              Confirm & Generate
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default FinishingPoGenerateWizard;
