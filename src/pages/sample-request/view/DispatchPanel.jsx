import { useState, useEffect, useMemo } from 'react';
import {
  App, Card, Form, Segmented, Select, Input, InputNumber, DatePicker, Upload,
  Button, Alert, Space, Typography, Row, Col, Tag,
} from 'antd';
import { UploadOutlined, CarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  listCouriers, listBuyingOffices, saveDispatchDraft, recordDispatch,
} from '../../../services/sr/srService';
import {
  DELIVERY_METHODS, DELIVERY_METHOD_LABELS, DISPATCH_MODE_OPTIONS, SR_STATUS,
} from '../../../utils/sampleRequestConstants';
import { getCurrentUser } from '../../../utils/permissions';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;
const { TextArea } = Input;

const ReadField = ({ label, children }) => (
  <Col xs={12} sm={8} md={6}>
    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{label}</Text>
    <Text strong style={{ fontSize: 13 }}>{children ?? '—'}</Text>
  </Col>
);

/**
 * Dispatch Update panel (PRD v3 §8.4). Delivery Method drives the mandatory
 * set: Courier → Tracking No mandatory; Local/Hand → Buying Office + Handed
 * Over To mandatory, tracking optional (docket only). Selecting a courier
 * flagged isLocal flips the method automatically. Overseas SRs are gated on an
 * issued commercial invoice. Mark as Dispatched is irreversible and locks all
 * fields; "Save without dispatching" survives a shift handover.
 */
const DispatchPanel = ({ sr, overseas, onChanged }) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [couriers, setCouriers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [docs, setDocs] = useState(sr.dispatch?.documents || []);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const method = Form.useWatch('deliveryMethod', form) || DELIVERY_METHODS.COURIER;
  const isLocal = method === DELIVERY_METHODS.LOCAL_HAND;
  const editable = sr.status === SR_STATUS.IN_PRODUCTION;
  const invoiceMissing = overseas && !sr.invoiceRef?.invoiceNo;

  useEffect(() => {
    Promise.all([
      listCouriers().then(setCouriers).catch(() => {}),
      listBuyingOffices().then(setOffices).catch(() => {}),
    ]).finally(() => setMastersLoading(false));
  }, []);

  useEffect(() => {
    const dsp = sr.dispatch;
    form.setFieldsValue({
      deliveryMethod: dsp?.deliveryMethod || DELIVERY_METHODS.COURIER,
      dispatchedDate: dsp?.dispatchedDate ? dayjs(dsp.dispatchedDate) : dayjs(),
      courierId: dsp?.courierId,
      trackingNo: dsp?.trackingNo,
      dispatchMode: dsp?.dispatchMode || (dsp?.deliveryMethod === DELIVERY_METHODS.LOCAL_HAND ? 'HAND_CARRY' : undefined),
      packages: dsp?.packages ?? 1,
      courierCost: dsp?.courierCost,
      buyingOffice: dsp?.buyingOffice,
      handedOverTo: dsp?.handedOverTo,
      acknowledgement: dsp?.acknowledgement,
      remarks: dsp?.remarks,
    });
    setDocs(dsp?.documents || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr.id, sr.dispatch]);

  const currentUserLabel = useMemo(() => {
    const u = getCurrentUser();
    const name = typeof u === 'string' ? u : (u?.name || u?.username || 'Logged-in user');
    return `${name} (logged-in)`;
  }, []);

  const buildDto = (values) => ({
    deliveryMethod: values.deliveryMethod,
    dispatchedDate: values.dispatchedDate ? values.dispatchedDate.format('YYYY-MM-DD') : null,
    courierId: values.courierId,
    courierName: couriers.find((c) => c.id === values.courierId)?.name || '',
    trackingNo: values.trackingNo || null,
    dispatchMode: values.dispatchMode,
    packages: values.packages ?? null,
    courierCost: values.courierCost ?? null,
    buyingOffice: values.buyingOffice || null,
    handedOverTo: values.handedOverTo || null,
    acknowledgement: values.acknowledgement || null,
    remarks: values.remarks || '',
    documents: docs,
  });

  const handleSaveOnly = async () => {
    setSavingDraft(true);
    try {
      const dto = buildDto(form.getFieldsValue());
      await saveDispatchDraft(sr.id, dto);
      message.success('Dispatch details saved — status unchanged');
      onChanged?.();
    } catch (e) {
      message.error(e.message || 'Failed to save');
    } finally { setSavingDraft(false); }
  };

  const handleDispatch = async () => {
    try {
      const values = await form.validateFields();
      modal.confirm({
        title: 'Mark as Dispatched?',
        content: 'This is irreversible — status moves to Dispatched and all dispatch fields lock permanently for audit integrity.',
        okText: 'Mark as Dispatched',
        onOk: async () => {
          setSaving(true);
          try {
            await recordDispatch(sr.id, buildDto(values));
            message.success(`${sr.srNo} marked as Dispatched — buyer approval countdown started`);
            onChanged?.();
          } catch (e) {
            message.error(e.message || 'Failed to dispatch');
          } finally { setSaving(false); }
        },
      });
    } catch { /* validation errors shown inline */ }
  };

  // Locked read-only rendering after dispatch
  if (!editable) {
    const dsp = sr.dispatch;
    if (!dsp) return null;
    return (
      <Card size="small" style={{ marginTop: 16 }} title="Dispatch Details" extra={<Tag color="cyan">locked after dispatch</Tag>}>
        <Row gutter={[16, 12]}>
          <ReadField label="Delivery Method">{DELIVERY_METHOD_LABELS[dsp.deliveryMethod] || dsp.deliveryMethod}</ReadField>
          <ReadField label="Dispatched Date">{formatDate(dsp.dispatchedDate)}</ReadField>
          <ReadField label="Courier / Carrier">{dsp.courierName}</ReadField>
          <ReadField label="Tracking Number">{dsp.trackingNo || '—'}</ReadField>
          <ReadField label="Dispatch Mode">{dsp.dispatchMode}</ReadField>
          <ReadField label="Packages">{dsp.packages}</ReadField>
          <ReadField label="Courier Cost">{dsp.courierCost != null ? dsp.courierCost.toLocaleString() : '—'}</ReadField>
          {dsp.buyingOffice && <ReadField label="Buying Office">{dsp.buyingOffice}</ReadField>}
          {dsp.handedOverTo && <ReadField label="Handed Over To">{dsp.handedOverTo}</ReadField>}
          {dsp.acknowledgement && <ReadField label="Acknowledgement">{dsp.acknowledgement}</ReadField>}
          <ReadField label="Dispatched By">{dsp.dispatchedBy}</ReadField>
        </Row>
        {dsp.remarks && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{dsp.remarks}</Text>}
        {(dsp.documents || []).length > 0 && (
          <div style={{ marginTop: 8 }}>
            {(dsp.documents || []).map((f) => <Tag key={f.name}>{f.name}</Tag>)}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card size="small" style={{ marginTop: 16 }} title="Dispatch Update" extra={<Tag color="blue">In Production · Dispatch / QC</Tag>}>
      {invoiceMissing && (
        <Alert
          style={{ marginBottom: 12 }}
          type="error"
          showIcon
          message={`Overseas consignee — commercial invoice required. ${sr.buyerName} · ${sr.buyerCountry} differs from the exporter's country, so this package cannot be marked dispatched without an issued invoice.`}
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="deliveryMethod" label="Delivery Method" rules={[{ required: true }]}>
          <Segmented
            options={[
              { label: DELIVERY_METHOD_LABELS.COURIER, value: DELIVERY_METHODS.COURIER },
              { label: DELIVERY_METHOD_LABELS.LOCAL_HAND, value: DELIVERY_METHODS.LOCAL_HAND },
            ]}
            onChange={(v) => {
              if (v === DELIVERY_METHODS.LOCAL_HAND) form.setFieldValue('dispatchMode', 'HAND_CARRY');
            }}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="dispatchedDate" label="Dispatched Date" rules={[{ required: true, message: 'Enter dispatched date' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="courierId" label="Courier / Carrier" rules={[{ required: true, message: 'Select courier' }]}>
              <Select
                placeholder="From Master Data"
                loading={mastersLoading}
                options={couriers.map((c) => ({ value: c.id, label: c.isLocal ? `${c.name} · local` : c.name }))}
                onChange={(id) => {
                  // A courier flagged is_local flips the method (PRD §8.4)
                  const courier = couriers.find((c) => c.id === id);
                  if (courier?.isLocal) {
                    form.setFieldsValue({ deliveryMethod: DELIVERY_METHODS.LOCAL_HAND, dispatchMode: 'HAND_CARRY' });
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="trackingNo"
              label={isLocal ? 'Tracking Number (optional)' : 'Tracking Number'}
              rules={isLocal ? [] : [{ required: true, message: 'Tracking number is mandatory for courier dispatch' }]}
              extra={isLocal ? 'Enter only if the local courier issues a docket' : undefined}
            >
              <Input placeholder={isLocal ? '—' : 'AWB / tracking no'} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="dispatchMode" label="Dispatch Mode" rules={[{ required: true, message: 'Select mode' }]}>
              <Select options={DISPATCH_MODE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Item name="packages" label="No. of Packages">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="courierCost" label="Courier Cost" tooltip="Tracked against the order (v1 enhancement)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item label="Dispatched By">
              <Input value={currentUserLabel} disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            </Form.Item>
          </Col>
          {isLocal && (
            <>
              <Col xs={24} sm={10}>
                <Form.Item name="buyingOffice" label="Buying Office / Location" rules={[{ required: true, message: 'Select buying office' }]}>
                  <Select
                    placeholder="Named local delivery locations"
                    loading={mastersLoading}
                    options={offices.map((o) => ({ value: o.name, label: o.name }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="handedOverTo" label="Handed Over To" rules={[{ required: true, message: 'Buyer-side contact who took delivery' }]}>
                  <Input placeholder="Buyer-side contact" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item name="acknowledgement" label="Acknowledgement" extra="Signed DC or email confirmation">
                  <Input placeholder="optional" />
                </Form.Item>
              </Col>
            </>
          )}
        </Row>
        {isLocal && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message="For hand delivery the signed delivery challan replaces the AWB as proof of dispatch — upload it under Dispatch Documents."
          />
        )}
        <Form.Item name="remarks" label="Dispatch Remarks">
          <TextArea rows={1} />
        </Form.Item>
        <Form.Item label="Dispatch Documents" extra="Packing list, AWB copy, or signed delivery challan · PDF or image · max 5 MB per file">
          <Upload
            multiple
            beforeUpload={(file) => {
              if (file.size > 5 * 1024 * 1024) {
                message.error(`${file.name} exceeds 5 MB`);
                return Upload.LIST_IGNORE;
              }
              setDocs((prev) => [...prev, { name: file.name, size: file.size, type: file.type }]);
              return false; // mock phase — metadata only; real phase uses fileService
            }}
            onRemove={(file) => setDocs((prev) => prev.filter((f) => f.name !== file.name))}
            fileList={docs.map((f, i) => ({ uid: String(i), name: f.name, status: 'done' }))}
          >
            <Button icon={<UploadOutlined />}>Add document</Button>
          </Upload>
        </Form.Item>
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button loading={savingDraft} onClick={handleSaveOnly}>Save without dispatching</Button>
          <Button
            type="primary"
            icon={<CarOutlined />}
            loading={saving}
            disabled={invoiceMissing}
            onClick={handleDispatch}
          >
            Mark as Dispatched
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

export default DispatchPanel;
