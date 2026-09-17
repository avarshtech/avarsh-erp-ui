import { useState, useEffect, useMemo } from 'react';
import { App, Row, Col, Card, Table, Typography, Tag, Collapse, Skeleton } from 'antd';
import ViewDialog from '../../../components/ViewDialog';
import StatusTag from '../../../components/StatusTag';
import ActivityTimeline from '../../../components/ActivityTimeline';
import { ActionButton } from '../../../components/buttons';
import { SAMPLE_INVOICE_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  SAMPLE_INVOICE_STATUS, getInvoiceStatusLabel, SAMPLE_DECLARATION_BAND,
} from '../../../utils/sampleRequestConstants';
import { amountInWords } from '../../../utils/amountInWords';
import { formatDate } from '../../../utils/formatters';
import { getInvoice } from '../../../services/sr/srService';

const { Text, Title } = Typography;

const Field = ({ label, children, span = { xs: 12, sm: 8, md: 6 } }) => (
  <Col {...span}>
    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
      {label}
    </Text>
    <Text strong style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{children || '—'}</Text>
  </Col>
);

/**
 * Read-only Commercial Invoice view (opened from the Sample Invoices list).
 * Issued invoices are immutable — this is a VIEW, not the edit wizard;
 * corrections go through Cancel + Duplicate (PRD §10.8).
 */
const SampleInvoiceView = ({ open, invoiceId, onClose, onPrint, onDuplicate, onCancelInvoice, canUpdate }) => {
  const { message } = App.useApp();
  const [inv, setInv] = useState(null);
  // Derived, not set synchronously in the effect: stale/absent record = loading
  const loading = open && invoiceId != null && inv?.id !== invoiceId;

  useEffect(() => {
    if (!open || invoiceId == null) return undefined;
    let cancelled = false;
    getInvoice(invoiceId)
      .then((data) => { if (!cancelled) setInv(data); })
      .catch((e) => {
        if (!cancelled) { message.error(e.message || 'Failed to load invoice'); onClose?.(); }
      });
    return () => { cancelled = true; };
  }, [open, invoiceId, message, onClose]);

  const lineColumns = useMemo(() => [
    { title: '#', key: 'idx', width: 40, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'HSN Code', dataIndex: 'hsnCode', key: 'hsnCode', width: 100 },
    { title: 'Description of Goods', dataIndex: 'description', key: 'description' },
    {
      title: 'From SR', key: 'fromSr', width: 150,
      render: (_, l) => (l.srNo
        ? <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.srNo}<br />{l.styleNo}</Text>
        : <Tag>manual line</Tag>),
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right', render: (v) => <Text strong>{v}</Text> },
    { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 60, align: 'center' },
    {
      title: `Rate (${inv?.currency || ''})`, dataIndex: 'rate', key: 'rate', width: 100, align: 'right',
      render: (v) => (v != null ? Number(v).toFixed(2) : '—'),
    },
    {
      title: 'Amount', key: 'amount', width: 100, align: 'right',
      render: (_, l) => <Text strong>{((Number(l.quantity) || 0) * (Number(l.rate) || 0)).toFixed(2)}</Text>,
    },
  ], [inv?.currency]);

  // Never show a stale record while a different invoice loads
  const current = !loading && inv ? inv : null;
  const issued = current?.status === SAMPLE_INVOICE_STATUS.ISSUED;

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1080}
      loading={loading}
      hero={current ? {
        title: inv.invoiceNo || 'DRAFT',
        status: (
          <StatusTag status={inv.status} config={SAMPLE_INVOICE_STATUS_CONFIG} getLabel={getInvoiceStatusLabel} />
        ),
        subtitle: [inv.consigneeName, inv.destinationCountry].filter(Boolean).join(' • '),
        highlight: inv.declaredValue != null
          ? { label: 'Declared Value', value: `${inv.currency} ${inv.declaredValue.toFixed(2)}` }
          : { label: 'Declared Value', value: 'not entered' },
      } : { title: 'Commercial Invoice' }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton action="print" text="Print" disabled={!current} onClick={() => current && onPrint(current)} />
            <ActionButton action="duplicate" text="Duplicate" disabled={!current} onClick={() => current && onDuplicate(current)} />
            {issued && canUpdate && (
              <ActionButton action="cancel" text="Cancel Invoice" onClick={() => { onCancelInvoice(current); onClose?.(); }} />
            )}
          </div>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      {!current ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <Card size="small" title={<Title level={5} style={{ margin: 0 }}>Invoice Header</Title>} style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              <Field label="Invoice Date">{formatDate(inv.invoiceDate)}</Field>
              <Field label="Series">{inv.series}</Field>
              <Field label="Buyer's Order No. & Date">{inv.buyerOrderNoDate}</Field>
              <Field label="Other References">{inv.otherReferences}</Field>
              <Field label="Country of Origin">{inv.countryOfOrigin}</Field>
              <Field label="Final Destination">{inv.finalDestination || inv.destinationCountry}</Field>
              <Field label="Terms of Delivery & Payment" span={{ xs: 24, sm: 16, md: 12 }}>{inv.termsOfDelivery}</Field>
              <Field label="Port of Loading">{inv.portOfLoading}</Field>
              <Field label="Port of Discharge">{inv.portOfDischarge}</Field>
              <Field label="Marks & Nos.">{inv.marksAndNos}</Field>
              <Field label="No. & Kind of Packages">{inv.packages}</Field>
              <Field label="Consignee" span={{ xs: 24, sm: 24, md: 12 }}>
                {[inv.consigneeName, inv.consigneeAddress].filter(Boolean).join('\n')}
              </Field>
              {inv.notifyParty && <Field label="Notify Party">{inv.notifyParty}</Field>}
            </Row>
          </Card>

          <Card size="small" title={<Title level={5} style={{ margin: 0 }}>Description of Goods</Title>} style={{ marginBottom: 16 }}>
            <Table
              rowKey="key"
              size="small"
              columns={lineColumns}
              dataSource={inv.lines || []}
              pagination={false}
              scroll={{ x: 900 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><Text strong>{inv.totalQty}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>{inv.declaredValue != null ? inv.declaredValue.toFixed(2) : '—'}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Text strong style={{ letterSpacing: 1 }}>{SAMPLE_DECLARATION_BAND}</Text>
            </div>
            {inv.declaredValue != null && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block' }}>Amount in Words</Text>
                <Text strong>{amountInWords(inv.declaredValue, inv.currency)}</Text>
              </div>
            )}
          </Card>

          <Collapse
            items={[{
              key: 'activity',
              label: `Activity Log (${(inv.activity || []).length})`,
              children: (
                <ActivityTimeline
                  activities={(inv.activity || []).map((a) => ({ ...a, type: 'system' }))}
                  maxHeight={260}
                />
              ),
            }]}
          />
        </>
      )}
    </ViewDialog>
  );
};

export default SampleInvoiceView;
