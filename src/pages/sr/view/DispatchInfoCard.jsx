import { Card, Tag, Row, Col, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../../utils/formatters';
import { DISPATCH_STATUS, DISPATCH_MODE_LABELS } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

const labelStyle = {
  fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block',
};

const Field = ({ label, children, span }) => (
  <Col xs={12} sm={span || 6}>
    <Text type="secondary" style={labelStyle}>{label}</Text>
    {children}
  </Col>
);

/**
 * Read-only dispatch summary on the SR detail (R2 — dispatch is its own
 * entity; one dispatch groups many SRs to one customer). Editing happens on
 * the Dispatches screen, reached via the Dispatch No link.
 */
const DispatchInfoCard = ({ sr }) => {
  const navigate = useNavigate();
  const d = sr?.dispatchInfo;
  if (!d) return null;

  const dispatched = d.status === DISPATCH_STATUS.DISPATCHED;

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title="Dispatch"
      extra={dispatched
        ? <Tag color="cyan" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Dispatched</Tag>
        : <Tag style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Draft — not yet dispatched</Tag>}
    >
      <Row gutter={[16, 12]}>
        <Field label="Dispatch No">
          <Text
            strong
            style={{ color: 'var(--primary-color)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => navigate(`/sample-requests/dispatches/list?viewId=${d.id}`)}
          >
            {d.dispatchNo}
          </Text>
        </Field>
        <Field label="Date"><Text strong>{d.dispatchedDate ? formatDate(d.dispatchedDate) : '—'}</Text></Field>
        <Field label="Courier"><Text strong>{d.courierName || '—'}</Text></Field>
        <Field label="Tracking"><Text strong>{d.trackingNo || '—'}</Text></Field>
        <Field label="Mode"><Text strong>{DISPATCH_MODE_LABELS[d.dispatchMode] || d.dispatchMode || '—'}</Text></Field>
        <Field label="Packages"><Text strong>{d.packages ?? '—'}</Text></Field>
        <Field label="Courier Cost"><Text strong>{d.courierCost != null ? `₹ ${d.courierCost}` : '—'}</Text></Field>
        {d.buyingOffice && (
          <Field label="Buying Office"><Text strong>{d.buyingOffice}</Text></Field>
        )}
        {d.handedOverTo && (
          <Field label="Handed Over To"><Text strong>{d.handedOverTo}</Text></Field>
        )}
        <Field label="Dispatched By"><Text strong>{d.dispatchedBy || '—'}</Text></Field>
      </Row>
      {(d.srIds || []).length > 1 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {d.srIds.length} SRs in this shipment
        </Text>
      )}
      {(d.documents || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={labelStyle}>Documents</Text>
          {d.documents.map((doc) => (
            <Tag key={doc.fileId || doc.id}>{doc.originalFilename}</Tag>
          ))}
        </div>
      )}
    </Card>
  );
};

export default DispatchInfoCard;
