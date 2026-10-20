import { Card, Descriptions, Divider, Tag, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { formatDate, formatNumber } from '../../../utils/formatters';
import { RAG_TAG_COLOR, daysRemaining, deadlineLabel, deadlineRag } from '../../../utils/deadlineUtils';

const { Title, Text } = Typography;

const SummaryRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
    <Text type="secondary">{label}</Text>
    <Text strong style={color ? { color } : undefined}>{value}</Text>
  </div>
);

/**
 * Side panel for the two sample issue forms — the request being issued against,
 * the line's demand, and what this document currently covers.
 *
 * FabricIssueSummaryPanel is not reusable here: its fields are Cutting PO, PO
 * line and production unit, none of which a sample has. `stats` is left to the
 * caller because the two forms count different things (rolls versus items) and
 * only the fabric form has a single line to measure a shortfall against.
 */
const SampleIssueSummaryPanel = ({ sr, line, stats = [], emptyText = 'Select a sample request' }) => {
  // The DTO carries the date, not the countdown — the same rule the register
  // and the SR screens use, so a deadline never reads as two severities.
  const days = daysRemaining(sr?.inHandDate);

  return (
    <Card style={{ height: '100%' }}>
      <Title level={5} style={{ marginBottom: 16 }}>Sample Request</Title>
      {sr ? (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="SR No">{sr.srNo}</Descriptions.Item>
            <Descriptions.Item label="Sample Type">
              <Tag color="purple" style={{ marginInlineEnd: 0 }}>{sr.sampleTypeName || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Style">{sr.styleNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Garment">{sr.garmentName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{sr.buyerName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Order">{sr.orderNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="In-Hand">
              {sr.inHandDate ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {formatDate(sr.inHandDate)}
                  <Tag color={RAG_TAG_COLOR[deadlineRag(days)]} style={{ marginInlineEnd: 0 }}>
                    {deadlineLabel(days)}
                  </Tag>
                </span>
              ) : '—'}
            </Descriptions.Item>
          </Descriptions>

          {line && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Title level={5} style={{ marginBottom: 12 }}>Material</Title>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Item">{line.description || line.itemCode || '—'}</Descriptions.Item>
                <Descriptions.Item label="Colour / Design">{line.colourDesign || '—'}</Descriptions.Item>
                <Descriptions.Item label="Required">
                  {`${formatNumber(line.requiredQty, 2)} ${line.uom || ''}`.trim()}
                </Descriptions.Item>
                <Descriptions.Item label="Already Issued">
                  {`${formatNumber(line.issuedCumulative, 2)} ${line.uom || ''}`.trim()}
                </Descriptions.Item>
                <Descriptions.Item label="In Stock">
                  {`${formatNumber(line.currentStock, 2)} ${line.uom || ''}`.trim()}
                </Descriptions.Item>
              </Descriptions>
            </>
          )}

          {stats.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Title level={5} style={{ marginBottom: 12 }}>Issue Summary</Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.map((s) => <SummaryRow key={s.label} {...s} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <InboxOutlined style={{ fontSize: 32, marginBottom: 8, color: 'var(--text-secondary)' }} />
          <br />
          <Text type="secondary">{emptyText}</Text>
        </div>
      )}
    </Card>
  );
};

export default SampleIssueSummaryPanel;
