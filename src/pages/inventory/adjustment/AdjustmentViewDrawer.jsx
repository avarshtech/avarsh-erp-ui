import { Drawer, Descriptions, Divider, Typography } from 'antd';
import { ActionButton } from '../../../components/buttons';
import { formatDate, formatNumber } from '../../../utils/formatters';
import AdjustmentCountTable from './AdjustmentCountTable';

const { Text } = Typography;

const AdjustmentViewDrawer = ({ open, onClose, record }) => {
  if (!record) return null;

  const totalVarianceQty = record.totalVarianceQty ?? (record.items || []).reduce((s, i) => s + (i.variance || 0), 0);
  const uom = record.uom || record.items?.[0]?.uom || '';

  return (
    <Drawer
      title={record.adjustmentNumber}
      open={open}
      onClose={onClose}
      width={960}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      <Descriptions size="small" column={{ xs: 1, sm: 2 }} title="Adjustment Information">
        <Descriptions.Item label="Adjustment #">{record.adjustmentNumber}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDate(record.adjustmentDate)}</Descriptions.Item>
        <Descriptions.Item label="Category">{record.categoryName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Sub-Category">{record.subCategoryName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Item Type">{record.itemTypeName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Adjusted By">{record.adjustedBy || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions size="small" column={{ xs: 1, sm: 2 }} title="Variance Summary">
        <Descriptions.Item label="Items Count">{record.items?.length || 0}</Descriptions.Item>
        <Descriptions.Item label="Total Variance">
          <Text strong style={{ color: totalVarianceQty < 0 ? 'var(--error-color)' : totalVarianceQty > 0 ? 'var(--success-color)' : undefined }}>
            {totalVarianceQty >= 0 ? '+' : ''}{formatNumber(totalVarianceQty, 2)} <Text type="secondary">{uom}</Text>
          </Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Text strong style={{ marginBottom: 8, display: 'block' }}>Adjustment Items</Text>
      {record.items && record.items.length > 0 ? (
        <AdjustmentCountTable items={record.items} readOnly />
      ) : (
        <Text type="secondary">No items</Text>
      )}
    </Drawer>
  );
};

export default AdjustmentViewDrawer;
