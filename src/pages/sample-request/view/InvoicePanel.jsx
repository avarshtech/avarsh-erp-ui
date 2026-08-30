import { Card, Typography, Tag, Button, Space } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

/**
 * Commercial Invoice panel (PRD §8.3/§8.4) — overseas consignees only.
 * Shows the linked invoice once raised, or the Generate Invoice route; the
 * overseas gate blocks Mark-as-Dispatched until one is issued.
 */
const InvoicePanel = ({ sr, overseas }) => {
  const navigate = useNavigate();
  if (!overseas) return null;
  const has = Boolean(sr.invoiceRef?.invoiceNo);
  return (
    <Card
      size="small"
      title="Commercial Invoice"
      extra={!has && <Tag color="red">Required — overseas</Tag>}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Consignee</Text>
          <Text strong>{sr.buyerName} · {sr.buyerCountry}</Text> <Tag color="purple">overseas</Tag>
        </div>
        {has ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Invoice No · Declared Value</Text>
            <Text strong>{sr.invoiceRef.invoiceNo}</Text>
            {sr.invoiceRef.declaredValue != null && (
              <Text style={{ marginInlineStart: 8 }}>{sr.invoiceRef.declaredValue.toFixed(2)}</Text>
            )}
          </div>
        ) : (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>
              This package cannot be marked dispatched without an issued invoice. One invoice can cover several styles to the same consignee.
            </Text>
            <Button
              type="primary"
              block
              icon={<FileProtectOutlined />}
              onClick={() => navigate(`/sample-requests/invoices/new?srId=${sr.id}`)}
            >
              Generate Commercial Invoice
            </Button>
          </>
        )}
      </Space>
    </Card>
  );
};

export default InvoicePanel;
