import { Card, Typography, Tag } from 'antd';
import { INVOICE_TYPES } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

/**
 * Read-only invoice panel (R2): invoices are raised from Dispatches → Invoices,
 * never from the SR. Shows the linked invoice when one exists; overseas SRs
 * without one get the explanatory hint (the dispatch gate enforces it).
 */
const InvoicePanel = ({ sr, overseas }) => {
  const ref = sr.invoiceRef;
  if (!ref && !overseas) return null;
  return (
    <Card
      size="small"
      title="Invoice"
      extra={!ref && overseas && <Tag color="red">Required before dispatch</Tag>}
    >
      {ref ? (
        <>
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block' }}>
            {ref.invoiceType === INVOICE_TYPES.SAMPLE ? 'Sample Invoice (chargeable)' : 'Commercial Invoice'}
          </Text>
          <Text strong>{ref.invoiceNo || 'DRAFT'}</Text>
          {ref.declaredValue != null && <Text style={{ marginInlineStart: 8 }}>{ref.declaredValue.toFixed(2)}</Text>}
        </>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Overseas consignee ({sr.buyerCountry}) — a commercial invoice must be issued before this
          sample can ship. Raise it from <Text strong>Dispatches → Invoices</Text>; the dispatch
          cannot be marked dispatched without it.
        </Text>
      )}
    </Card>
  );
};

export default InvoicePanel;
