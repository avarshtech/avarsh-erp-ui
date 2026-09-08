import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Col, Row, Select, Space, Tag, Typography } from 'antd';
import { FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ActionButton from '../../../components/buttons/ActionButton';
import EmptyState from '../../../components/EmptyState';
import FileUpload from '../../../components/FileUpload';
import RecordLink from '../../../components/RecordLink';
import { billLinesWithGrn } from '../../../utils/billPassingCalc';
import { downloadFileAsBlob } from '../../../services/core/fileService';

const { Text } = Typography;

const DOC_TYPES = [
  { value: 'SUPPLIER_INVOICE', label: 'Supplier Invoice' },
  { value: 'DEBIT_NOTE', label: 'Debit Note' },
  { value: 'DELIVERY_CHALLAN', label: 'Delivery Challan' },
  { value: 'WEIGHMENT_SLIP', label: 'Weighment Slip' },
  { value: 'LR', label: 'LR / Transport Copy' },
  { value: 'EWAY_BILL', label: 'E-Way Bill' },
  { value: 'OTHER', label: 'Other' },
];

const DOC_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.value, d.label]));

const sizeKb = (bytes) => (Number(bytes) ? `${(Number(bytes) / 1024).toFixed(1)} KB` : '-');
const stamp = (v) => (v ? dayjs(v).format('DD-MMM-YYYY hh:mm A') : '-');
const qcSegment = (grnType) => (String(grnType || '').toLowerCase() === 'trims' ? 'trims' : 'fabric');

/** FR-BP-901/902 — documents recorded against the bill, plus the ERP records it already links to. */
const BpAttachments = memo(function BpAttachments({ bill, readOnly, onAdd, onRemove }) {
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const [docType, setDocType] = useState('SUPPLIER_INVOICE');

  const attachments = useMemo(() => bill?.attachments || [], [bill]);
  const hasInvoice = attachments.some((a) => a.docType === 'SUPPLIER_INVOICE');

  // One entry per distinct QC report behind the billed lines.
  const qcRefs = useMemo(() => {
    const grnTypeById = new Map((bill?.grns || []).map((g) => [g.grnId, g.grnType]));
    const seen = new Map();
    billLinesWithGrn(bill).forEach((l) => {
      if (l.qcId && !seen.has(l.qcId)) {
        seen.set(l.qcId, { qcId: l.qcId, qcNumber: l.qcNumber || `QC-${l.qcId}`, grnType: grnTypeById.get(l.grnId) });
      }
    });
    return [...seen.values()];
  }, [bill]);

  const handleSelect = useCallback((file) => {
    onAdd?.({ docType, file });
  }, [docType, onAdd]);

  /** The file itself lives in the shared store; fetch it and hand it to the browser. */
  const handleDownload = useCallback(async (att) => {
    try {
      const blob = await downloadFileAsBlob(att.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // The interceptor has already shown the server's message; this is for
      // the failure it cannot see, where the request never got an answer.
      if (!e.response) message.error(e.errorMessage || 'Could not download that document');
    }
  }, [message]);

  const confirmRemove = useCallback((att) => {
    modal.confirm({
      title: 'Remove this document?',
      content: `${att.fileName} will no longer be recorded against this bill.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Keep',
      onOk: () => onRemove?.(att.id),
    });
  }, [modal, onRemove]);

  const linkedDocs = useMemo(() => [
    bill?.poId && {
      key: `po-${bill.poId}`, tag: 'PO', text: bill.poNumber || `PO-${bill.poId}`,
      onClick: () => navigate(`/purchase-orders/supplier-po/edit/${bill.poId}`),
    },
    ...(bill?.grns || []).map((g) => ({
      key: `grn-${g.grnId}`, tag: 'GRN', text: g.grnNumber || `GRN-${g.grnId}`,
      onClick: () => navigate(`/inventory/grn/${qcSegment(g.grnType) === 'trims' ? 'accessories' : 'fabric'}/edit/${g.grnId}`),
    })),
    ...qcRefs.map((q) => ({
      key: `qc-${q.qcId}`, tag: 'QC', text: q.qcNumber,
      onClick: () => navigate(`/inventory/qc/${qcSegment(q.grnType)}/${q.qcId}`),
    })),
  ].filter(Boolean), [bill, qcRefs, navigate]);

  return (
    <>
      {!readOnly && (
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={24} md={7}>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Document Type</Text>
            <Select
              style={{ width: '100%' }}
              value={docType}
              onChange={setDocType}
              options={DOC_TYPES}
            />
          </Col>
          <Col xs={24} md={17}>
            <FileUpload
              accept=".pdf,.png,.jpg,.jpeg"
              maxSizeMB={10}
              compact
              placeholder={`Click or drag to record a ${DOC_LABEL[docType]}`}
              onSelect={handleSelect}
            />
          </Col>
        </Row>
      )}

      <Text style={{ display: 'block', marginBottom: 8, fontSize: 12, color: hasInvoice ? 'var(--text-secondary)' : 'var(--error-color)' }}>
        <span style={{ color: 'var(--error-color)' }}>*</span>
        {' '}
        The supplier invoice copy is mandatory before this bill can be submitted.
      </Text>

      {attachments.length ? attachments.map((att, i) => (
        <div
          key={att.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 0',
            borderTop: i ? '1px solid var(--border-color)' : 'none',
          }}
        >
          <FileTextOutlined style={{ fontSize: 20, color: 'var(--primary-color)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space size={6} wrap>
              <Tag color={att.docType === 'SUPPLIER_INVOICE' ? 'blue' : 'default'}>
                {DOC_LABEL[att.docType] || att.docType}
              </Tag>
              <Text strong style={{ fontSize: 13 }}>{att.fileName}</Text>
            </Space>
            <div>
              <Text style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {`${sizeKb(att.size)} · Uploaded by ${att.uploadedBy || '-'} on ${stamp(att.uploadedAt)}`}
              </Text>
            </div>
          </div>
          <Space size={4}>
            <ActionButton action="download" tooltip="Download" onClick={() => handleDownload(att)} />
            {!readOnly && (
              <ActionButton action="delete" tooltip="Remove document" onClick={() => confirmRemove(att)} />
            )}
          </Space>
        </div>
      )) : (
        <EmptyState
          title="No documents yet"
          description="Record the supplier invoice copy, and any challan, weighment slip or transport copy that supports it."
        />
      )}

      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <Space size={6} style={{ marginBottom: 6 }}>
          <LinkOutlined style={{ color: 'var(--primary-color)' }} />
          <Text strong style={{ fontSize: 13 }}>Linked ERP documents</Text>
        </Space>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          These are links to the source records already in the ERP. They are never re-uploaded as attachments.
        </div>
        {linkedDocs.length ? (
          <Space size={[16, 8]} wrap>
            {linkedDocs.map((d) => (
              <Space key={d.key} size={4}>
                <Tag color="default">{d.tag}</Tag>
                <RecordLink text={d.text} onClick={d.onClick} />
              </Space>
            ))}
          </Space>
        ) : (
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            No PO, GRN or QC is linked to this bill yet.
          </Text>
        )}
      </div>
    </>
  );
});

export default BpAttachments;
