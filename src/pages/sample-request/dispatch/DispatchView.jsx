import { useState, useEffect } from 'react';
import { App, Row, Col, Card, Tag, Typography, Collapse, Skeleton } from 'antd';
import ViewDialog from '../../../components/ViewDialog';
import StatusTag from '../../../components/StatusTag';
import ActivityTimeline from '../../../components/ActivityTimeline';
import { ActionButton } from '../../../components/buttons';
import { SR_DISPATCH_STATUS_CONFIG, SR_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  DISPATCH_STATUS, DELIVERY_METHOD_LABELS, DISPATCH_MODE_LABELS,
  getDispatchStatusLabel, getSrStatusLabel,
} from '../../../utils/sampleRequestConstants';
import { formatDate } from '../../../utils/formatters';
import { getDispatch } from '../../../services/sr/srService';

const { Text, Title } = Typography;

const labelStyle = {
  fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2,
};

const Field = ({ label, children, span = { xs: 12, sm: 8, md: 6 } }) => (
  <Col {...span}>
    <Text type="secondary" style={labelStyle}>{label}</Text>
    <Text strong style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{children || '—'}</Text>
  </Col>
);

/**
 * Read-only dispatch view (R2) — a dialog like every other view in the module,
 * not a full page. A dispatched record is immutable, so this is the terminal
 * destination for it; drafts open the form instead, where they stay editable.
 */
const DispatchView = ({ open, dispatchId, onClose, onEdit }) => {
  const { message } = App.useApp();
  const [record, setRecord] = useState(null);
  // Derived, never set synchronously in the effect: a stale record = loading
  const loading = open && dispatchId != null && record?.id !== Number(dispatchId);

  useEffect(() => {
    if (!open || dispatchId == null) return undefined;
    let cancelled = false;
    getDispatch(dispatchId)
      .then((data) => { if (!cancelled) setRecord(data); })
      .catch((e) => {
        if (!cancelled) { message.error(e.message || 'Failed to load the dispatch'); onClose?.(); }
      });
    return () => { cancelled = true; };
  }, [open, dispatchId, message, onClose]);

  const current = !loading && record ? record : null;
  const draft = current?.status === DISPATCH_STATUS.DRAFT;

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1080}
      hero={current ? {
        title: current.dispatchNo,
        status: (
          <>
            <StatusTag status={current.status} config={SR_DISPATCH_STATUS_CONFIG} getLabel={getDispatchStatusLabel} />
            {current.overseas && <Tag color="purple">overseas</Tag>}
          </>
        ),
        subtitle: [current.buyerName, current.buyerCountry].filter(Boolean).join(' • '),
        highlight: { label: 'Sample Requests', value: `${current.srCount ?? 0}` },
      } : { title: 'Dispatch' }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {draft && onEdit && (
              <ActionButton action="edit" text="Edit Draft" onClick={() => { onEdit(current); onClose?.(); }} />
            )}
          </div>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      {!current ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Col xs={12} sm={8} md={6} key={i}>
                  <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                  <Skeleton.Input active size="small" block />
                </Col>
              ))}
            </Row>
          </Card>
          <Card size="small" style={{ marginBottom: 16 }}><Skeleton active title={false} paragraph={{ rows: 3 }} /></Card>
          <Skeleton.Input active block />
        </>
      ) : (
        <>
          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>Shipment</Title>}
            extra={!draft && <Tag color="cyan" style={{ marginInlineEnd: 0 }}>locked after dispatch</Tag>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[24, 16]}>
              <Field label="Customer">{current.buyerName}</Field>
              <Field label="Destination">{current.buyerCountry}</Field>
              <Field label="Delivery Method">
                {DELIVERY_METHOD_LABELS[current.deliveryMethod] || current.deliveryMethod}
              </Field>
              <Field label="Dispatched Date">
                {draft ? '— not yet dispatched —' : formatDate(current.dispatchedDate)}
              </Field>
              <Field label="Courier / Carrier">{current.courierName}</Field>
              <Field label="Tracking Number">{current.trackingNo}</Field>
              <Field label="Dispatch Mode">
                {DISPATCH_MODE_LABELS[current.dispatchMode] || current.dispatchMode}
              </Field>
              <Field label="Packages">{current.packages}</Field>
              <Field label="Courier Cost">
                {current.courierCost != null ? current.courierCost.toLocaleString() : null}
              </Field>
              {current.buyingOffice && <Field label="Buying Office">{current.buyingOffice}</Field>}
              {current.handedOverTo && <Field label="Handed Over To">{current.handedOverTo}</Field>}
              {current.acknowledgement && <Field label="Acknowledgement">{current.acknowledgement}</Field>}
              <Field label="Dispatched By">{current.dispatchedBy}</Field>
            </Row>
            {current.remarks && (
              <div style={{ marginTop: 14 }}>
                <Text type="secondary" style={labelStyle}>Remarks</Text>
                <Text>{current.remarks}</Text>
              </div>
            )}
            {(current.documents || []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary" style={labelStyle}>Documents</Text>
                {(current.documents || []).map((f) => <Tag key={f.name || f}>{f.name || f}</Tag>)}
              </div>
            )}
          </Card>

          <Card
            size="small"
            title={<Title level={5} style={{ margin: 0 }}>{`Sample Requests (${current.srCount ?? 0})`}</Title>}
            style={{ marginBottom: 16 }}
          >
            {(current.srs || []).map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '6px 0', borderBottom: '1px solid var(--border-color)',
                }}
              >
                <Text strong style={{ whiteSpace: 'nowrap' }}>{s.srNo}</Text>
                <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{s.styleNo}</Text>
                <Text ellipsis style={{ flex: 1, minWidth: 140 }}>{s.garmentName}</Text>
                <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{s.sampleTypeName}</Tag>
                <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{`Qty ${s.quantity ?? '—'}`}</Text>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <StatusTag status={s.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
                </span>
              </div>
            ))}
          </Card>

          <Collapse
            items={[{
              key: 'activity',
              label: `Activity Log (${(current.activity || []).length})`,
              children: (
                <ActivityTimeline
                  activities={(current.activity || []).map((a) => ({ ...a, type: 'system' }))}
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

export default DispatchView;
