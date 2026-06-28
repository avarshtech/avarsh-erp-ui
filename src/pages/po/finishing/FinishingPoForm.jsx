import { useState, useEffect } from 'react';
import { App, Card, Form, Tabs, Space, Tag, Typography, Input, Descriptions, Spin } from 'antd';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormDatePicker, FormInputNumber, FormSelect, FormSection } from '../../../components/form';
import SizeColorMatrix from '../SizeColorMatrix';
import MaterialStockPanel from '../components/MaterialStockPanel';
import { FINISHING_PROCESS, getProcessLabel, PO_ACTION, isPpApproved } from '../../../utils/productionConstants';
import {
  getFinishingPo, updateFinishingPo, changeFinishingPoStatus, getStockByBom, getPpApprovalStatus, getProcessingUnits,
} from '../../../services/po/productionService';

const { Text } = Typography;

const FinishingPoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [po, setPo] = useState(null);
  const [stock, setStock] = useState([]);
  const [ppStatus, setPpStatus] = useState(null);
  const [units, setUnits] = useState([]);
  const [hasShortage, setHasShortage] = useState(false);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getProcessingUnits('UNIT').then(setUnits); }, []);

  useEffect(() => {
    getFinishingPo(id).then(async (record) => {
      if (!record) { message.error('Finishing PO not found'); return navigate('/purchase-orders/finishing-po/list'); }
      setPo(record);
      setPpStatus(await getPpApprovalStatus(record.orderId));
      if ((record.processes || []).some((p) => p.processName === FINISHING_PROCESS.PACKING)) {
        setStock(await getStockByBom(record.orderId, 'packing'));
      }
      form.setFieldsValue({
        plannedStartDate: record.plannedStartDate ? dayjs(record.plannedStartDate) : null,
        plannedEndDate: record.plannedEndDate ? dayjs(record.plannedEndDate) : null,
        processingUnitId: record.processingUnitId,
        vendorRate: record.vendorRate, vendorDeliveryDate: record.vendorDeliveryDate ? dayjs(record.vendorDeliveryDate) : null,
        remarks: record.remarks,
      });
    }).finally(() => setBooting(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (submit) => {
    const v = await form.validateFields();
    if (submit && hasShortage && !(await new Promise((res) => modal.confirm({
      title: 'Submit despite packing-material shortage?',
      content: 'One or more packing materials are short for this PO. Submit for approval anyway?',
      okText: 'Submit anyway', cancelText: 'Review', onOk: () => res(true), onCancel: () => res(false),
    })))) return;
    setSaving(true);
    try {
      const payload = {
        ...po,
        plannedStartDate: v.plannedStartDate?.format('YYYY-MM-DD'), plannedEndDate: v.plannedEndDate?.format('YYYY-MM-DD'),
        processingUnitId: po.isOutsourced ? po.processingUnitId : v.processingUnitId,
        processingUnitName: po.isOutsourced ? po.vendorName : (units.find((u) => u.id === v.processingUnitId)?.name || po.processingUnitName),
        vendorRate: v.vendorRate, vendorDeliveryDate: v.vendorDeliveryDate?.format('YYYY-MM-DD'), remarks: v.remarks,
      };
      const saved = await updateFinishingPo(id, payload);
      if (submit) await changeFinishingPoStatus(saved.id, PO_ACTION.SUBMIT, {});
      message.success(`${saved.finishingPoNo} ${submit ? 'submitted' : 'saved'}`);
      navigate('/purchase-orders/finishing-po/list');
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (booting || !po) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const hasPacking = (po.processes || []).some((p) => p.processName === FINISHING_PROCESS.PACKING);
  const ppApproved = isPpApproved(ppStatus);

  const tabs = [
    { key: 'general', label: 'General', children: (
      <>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Order">{po.orderNo}</Descriptions.Item>
          <Descriptions.Item label="Style">{po.styleNo}</Descriptions.Item>
          <Descriptions.Item label="Work Order">{po.workOrderNo}</Descriptions.Item>
          <Descriptions.Item label="Processing">{po.isOutsourced ? po.vendorName : 'In-house'}</Descriptions.Item>
          <Descriptions.Item label="Processes" span={2}>
            <Space wrap>{(po.processes || []).map((p) => <Tag key={p.processName} color="blue">{getProcessLabel(p.processName)}</Tag>)}</Space>
          </Descriptions.Item>
        </Descriptions>
        {!po.isOutsourced && (
          <FormSection title="Processing Unit" columns={2}>
            <Form.Item name="processingUnitId" label="In-house Unit">
              <FormSelect placeholder="Select finishing unit" options={units.map((u) => ({ value: u.id, label: u.name }))} />
            </Form.Item>
          </FormSection>
        )}
        <FormSection title="Schedule" columns={2}>
          <Form.Item name="plannedStartDate" label="Planned Start" rules={[{ required: true, message: 'Required' }]}><FormDatePicker /></Form.Item>
          <Form.Item name="plannedEndDate" label="Planned End" rules={[{ required: true, message: 'Required' }]}>
            <FormDatePicker disabledDate={(d) => { const s = form.getFieldValue('plannedStartDate'); return d && s && d.isBefore(s, 'day'); }} />
          </Form.Item>
        </FormSection>
        <FormSection title="Other" columns={1}>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} maxLength={300} /></Form.Item>
        </FormSection>
      </>
    ) },
    { key: 'matrix', label: 'Size-Color Matrix', children: (
      <SizeColorMatrix items={po.items || []} onChange={() => {}} editable={false} allowanceEditable={false} />
    ) },
    ...(hasPacking ? [{ key: 'packing', label: 'Packing Stock', children: (
      <MaterialStockPanel rows={stock} materialType="packing" onShortageChange={setHasShortage} />
    ) }] : []),
    ...(po.isOutsourced ? [{ key: 'vendor', label: 'Vendor', children: (
      <FormSection title={`Vendor — ${po.vendorName}`} columns={2}>
        <Form.Item name="vendorRate" label="Rate / Pc"><FormInputNumber variant="currency" currency="INR" /></Form.Item>
        <Form.Item name="vendorDeliveryDate" label="Vendor Delivery Date"><FormDatePicker /></Form.Item>
      </FormSection>
    ) }] : []),
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={`Edit ${po.finishingPoNo}`} backPath="/purchase-orders/finishing-po/list">
        <ActionButton action="save" variant="draft" text="Save Draft" loading={saving} onClick={() => save(false)} />
        <ActionButton action="send" text="Save & Submit" loading={saving} disabled={!ppApproved}
          tooltip={!ppApproved ? 'PP Sample not yet approved for this order' : undefined} onClick={() => save(true)} />
      </PageHeader>
      <Card><Form form={form} layout="vertical"><Tabs items={tabs} /></Form></Card>
    </div>
  );
};

export default FinishingPoForm;
