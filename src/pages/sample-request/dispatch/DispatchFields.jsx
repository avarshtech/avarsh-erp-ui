import { useCallback, useMemo } from 'react';
import {
  App, Form, Segmented, Select, Input, InputNumber, DatePicker, Upload, Button, Alert, Row, Col,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { DELIVERY_METHODS, DELIVERY_METHOD_LABELS, DISPATCH_MODE_OPTIONS } from '../../../utils/sampleRequestConstants';

const { TextArea } = Input;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/**
 * Dispatch capture fields (PRD §8.4) — presentational section rendered inside
 * DispatchForm's <Form>. Delivery Method drives the mandatory set: Courier →
 * Tracking No mandatory; Local/Hand → Buying Office + Handed Over To mandatory,
 * tracking optional (docket only). A courier flagged isLocal flips the method.
 */
const DispatchFields = ({ form, couriers, offices, mastersLoading, docs, setDocs, currentUserLabel }) => {
  const { message } = App.useApp();
  const method = Form.useWatch('deliveryMethod', form) || DELIVERY_METHODS.COURIER;
  const isLocal = method === DELIVERY_METHODS.LOCAL_HAND;

  const handleMethodChange = useCallback((v) => {
    if (v === DELIVERY_METHODS.LOCAL_HAND) form.setFieldValue('dispatchMode', 'HAND_CARRY');
  }, [form]);

  const handleCourierChange = useCallback((id) => {
    // A courier flagged is_local flips the method (PRD §8.4)
    const courier = couriers.find((c) => c.id === id);
    if (courier?.isLocal) {
      form.setFieldsValue({ deliveryMethod: DELIVERY_METHODS.LOCAL_HAND, dispatchMode: 'HAND_CARRY' });
    }
  }, [couriers, form]);

  const beforeUpload = useCallback((file) => {
    if (file.size > MAX_DOC_BYTES) {
      message.error(`${file.name} exceeds 5 MB`);
      return Upload.LIST_IGNORE;
    }
    setDocs((prev) => [...prev, { name: file.name, size: file.size, type: file.type }]);
    return false; // mock phase — metadata only; real phase uses fileService
  }, [message, setDocs]);

  const handleRemoveDoc = useCallback((file) => {
    setDocs((prev) => prev.filter((f) => f.name !== file.name));
  }, [setDocs]);

  const fileList = useMemo(
    () => docs.map((f, i) => ({ uid: String(i), name: f.name, status: 'done' })),
    [docs],
  );

  const courierOptions = useMemo(
    () => couriers.map((c) => ({ value: c.id, label: c.isLocal ? `${c.name} · local` : c.name })),
    [couriers],
  );

  const officeOptions = useMemo(() => offices.map((o) => ({ value: o.name, label: o.name })), [offices]);

  return (
    <>
      <Form.Item name="deliveryMethod" label="Delivery Method" rules={[{ required: true }]}>
        <Segmented
          options={[
            { label: DELIVERY_METHOD_LABELS.COURIER, value: DELIVERY_METHODS.COURIER },
            { label: DELIVERY_METHOD_LABELS.LOCAL_HAND, value: DELIVERY_METHODS.LOCAL_HAND },
          ]}
          onChange={handleMethodChange}
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
              options={courierOptions}
              onChange={handleCourierChange}
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
          <Form.Item name="courierCost" label="Courier Cost" tooltip="Recovered cost tracked against the order">
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
                  options={officeOptions}
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
          accept=".pdf,image/*"
          beforeUpload={beforeUpload}
          onRemove={handleRemoveDoc}
          fileList={fileList}
        >
          <Button icon={<UploadOutlined />}>Add document</Button>
        </Upload>
      </Form.Item>
    </>
  );
};

export default DispatchFields;
