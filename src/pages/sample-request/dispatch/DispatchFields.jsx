import { useCallback, useEffect, useMemo } from 'react';
import {
  App, Form, Segmented, Select, Input, InputNumber, DatePicker, Upload, Button, Alert, Row, Col, Space,
} from 'antd';
import { UploadOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { DELIVERY_METHODS, DELIVERY_METHOD_LABELS, DISPATCH_MODE_OPTIONS } from '../../../utils/sampleRequestConstants';
import { downloadStoredFile } from '../../../services/core/fileService';

const { TextArea } = Input;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** The buyer's own shipping location, worded the way the server snapshots it. */
const locationLabel = (l) => (l.city ? `${l.label} — ${l.city}` : l.label);

/**
 * Saved documents plus the picker, as ONE element so the surrounding Form.Item
 * has a single child to bind to. The injected value/onChange are deliberately
 * ignored: the documents live in DispatchForm's state, and what the field
 * carries is only how many there are — enough for the mandatory-document rule
 * to decide, and DispatchFields keeps it in step.
 */
const DispatchDocuments = ({ documents, fileList, onDownload, beforeUpload, onRemovePending }) => (
  <>
    {(documents || []).length > 0 && (
      <Space orientation="vertical" size={2} style={{ display: 'flex', marginBottom: 8 }}>
        {documents.map((doc) => (
          <Space key={doc.fileId || doc.id} size={4}>
            <PaperClipOutlined style={{ color: 'var(--text-secondary)' }} />
            <span>{doc.originalFilename}</span>
            <Button
              size="small"
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => onDownload(doc)}
            >
              Download
            </Button>
          </Space>
        ))}
      </Space>
    )}
    <Upload
      multiple
      accept=".pdf,image/*"
      beforeUpload={beforeUpload}
      onRemove={onRemovePending}
      fileList={fileList}
    >
      <Button icon={<UploadOutlined />}>Add document</Button>
    </Upload>
  </>
);

/**
 * Dispatch capture fields (PRD §8.4) — presentational section rendered inside
 * DispatchForm's <Form>. Delivery Method drives the mandatory set: Courier →
 * Tracking No mandatory; Local/Hand → Buying Office + Handed Over To + at least
 * one Dispatch Document mandatory, tracking optional (docket only). A courier
 * flagged isLocal flips the method.
 *
 * A hand delivery has no AWB to prove it happened, so the signed challan is the
 * only evidence — hence the document rule. It bites on Mark as Dispatched,
 * which is the irreversible step and the point at which the challan exists;
 * Save Draft stays permissive so a shipment can be parked mid-entry.
 *
 * The Buying Office is one of the consignee's own shipping locations: the form
 * sends the location id and the server snapshots its label onto the dispatch,
 * so a location later renamed does not rewrite where a parcel already went.
 */
const DispatchFields = ({
  form, couriers, locations, mastersLoading, documents, pendingFiles, setPendingFiles, currentUserLabel,
}) => {
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
    // Staged, not sent: the upload needs a dispatch id, so it waits for the save
    setPendingFiles((prev) => [...prev, file]);
    return false;
  }, [message, setPendingFiles]);

  const handleRemovePending = useCallback((file) => {
    setPendingFiles((prev) => prev.filter((f) => f.uid !== file.uid));
  }, [setPendingFiles]);

  const handleDownload = useCallback(async (doc) => {
    try {
      await downloadStoredFile(doc);
    } catch {
      message.error(`Failed to download ${doc.originalFilename || 'the document'}`);
    }
  }, [message]);

  const fileList = useMemo(
    () => pendingFiles.map((f) => ({ uid: f.uid, name: f.name, status: 'done' })),
    [pendingFiles],
  );

  const courierOptions = useMemo(
    () => couriers.map((c) => ({ value: c.id, label: c.isLocal ? `${c.name} · local` : c.name })),
    [couriers],
  );

  const officeOptions = useMemo(
    () => (locations || []).map((l) => ({ value: l.id, label: locationLabel(l) })),
    [locations],
  );

  // What the mandatory-document rule reads. Saved and still-pending documents
  // count the same: a file staged for upload is one the user has provided.
  const docCount = (documents || []).length + pendingFiles.length;

  // Keep the field in step with the documents so the rule sees the current
  // count, and drop a complaint the moment it stops being true. Validation is
  // never raised here — only cleared — so nothing goes red before the user has
  // tried to dispatch.
  useEffect(() => {
    form.setFieldValue('documentsPresent', docCount);
    if (form.getFieldError('documentsPresent').length) {
      form.validateFields(['documentsPresent']).catch(() => {});
    }
  }, [form, docCount, isLocal]);

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
              <Form.Item
                name="buyingOfficeLocationId"
                label="Buying Office / Location"
                rules={[{ required: true, message: 'Select buying office' }]}
                extra={!mastersLoading && officeOptions.length === 0
                  ? 'This buyer has no active shipping location — add one in Master Data → Buyers'
                  : "The consignee's own shipping locations"}
              >
                <Select
                  placeholder="Buyer shipping locations"
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
          title="For hand delivery the signed delivery challan replaces the AWB as proof of dispatch — upload it under Dispatch Documents."
        />
      )}
      <Form.Item name="remarks" label="Dispatch Remarks">
        <TextArea rows={1} />
      </Form.Item>
      <Form.Item
        name="documentsPresent"
        label="Dispatch Documents"
        required={isLocal}
        extra={isLocal
          ? 'Signed delivery challan — mandatory for a hand delivery · PDF or image · max 5 MB per file'
          : 'Packing list, AWB copy, or signed delivery challan · PDF or image · max 5 MB per file'}
        rules={[{
          validator: () => (!isLocal || docCount > 0
            ? Promise.resolve()
            : Promise.reject(new Error('Upload the signed delivery challan — a document is mandatory for local / hand delivery'))),
        }]}
      >
        <DispatchDocuments
          documents={documents}
          fileList={fileList}
          onDownload={handleDownload}
          beforeUpload={beforeUpload}
          onRemovePending={handleRemovePending}
        />
      </Form.Item>
    </>
  );
};

export default DispatchFields;
