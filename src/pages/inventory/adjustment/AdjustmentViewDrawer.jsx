import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Tag, Typography } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { ADJUSTMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatDate, formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const itemColumns = [
  { title: 'Item / Roll ID', dataIndex: 'itemId', key: 'itemId', width: 140, ellipsis: true },
  { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
  { title: 'System Qty', dataIndex: 'systemQty', key: 'systemQty', width: 100, align: 'right', render: (v) => formatNumber(v, 2) },
  { title: 'Physical Count', dataIndex: 'physicalCount', key: 'physicalCount', width: 110, align: 'right', render: (v) => formatNumber(v, 2) },
  {
    title: 'Variance', key: 'variance', width: 100, align: 'right',
    render: (_, r) => {
      const v = (r.physicalCount || 0) - (r.systemQty || 0);
      return <Text style={{ color: v === 0 ? 'var(--text-secondary)' : v > 0 ? 'var(--success-color)' : 'var(--error-color)', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{formatNumber(v, 2)}</Text>;
    },
  },
  {
    title: 'Variance %', key: 'variancePct', width: 100, align: 'right',
    render: (_, r) => {
      const v = r.systemQty ? (((r.physicalCount || 0) - r.systemQty) / r.systemQty) * 100 : 0;
      return <Text style={{ color: Math.abs(v) <= 2 ? 'var(--text-secondary)' : 'var(--error-color)' }}>{formatNumber(v, 1)}%</Text>;
    },
  },
];

const AdjustmentViewDrawer = ({ open, onClose, record }) => {
  const title = useMemo(
    () =>
      record ? (
        <Space>
          <span>{record.adjustmentNumber}</span>
          <StatusTag status={record.status} config={ADJUSTMENT_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Space>
      ) : 'Adjustment Details',
    [record],
  );

  if (!record) return null;

  return (
    <Drawer title={title} open={open} onClose={onClose} width={720} footer={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ActionButton action="print" text="Print Adjustment" />
        <ActionButton action="close" text="Close" onClick={onClose} />
      </div>
    }>
      <Descriptions size="small" column={2} title="Adjustment Information">
        <Descriptions.Item label="Type"><Tag color={record.type === 'Fabric' ? 'blue' : 'purple'}>{record.type}</Tag></Descriptions.Item>
        <Descriptions.Item label="Date">{formatDate(record.adjustmentDate)}</Descriptions.Item>
        <Descriptions.Item label="Counted By">{record.countedBy}</Descriptions.Item>
        <Descriptions.Item label="Reason">{record.reason || '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <StatusTag status={record.status} config={ADJUSTMENT_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions size="small" column={2} title="Variance Summary">
        <Descriptions.Item label="Total Variance Value">
          <CurrencyDisplay amount={record.totalVarianceValue} color={record.totalVarianceValue < 0 ? 'var(--error-color)' : 'var(--success-color)'} />
        </Descriptions.Item>
        <Descriptions.Item label="Items Count">{record.items?.length || 0}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <Text strong style={{ marginBottom: 8, display: 'block' }}>Adjustment Items</Text>
      {record.items && record.items.length > 0 ? (
        <Table rowKey="id" columns={itemColumns} dataSource={record.items} pagination={false} size="small" scroll={{ x: 750 }} />
      ) : (
        <Text type="secondary">Item details not available in list view</Text>
      )}

      <Divider />

      <Descriptions size="small" column={2} title="Approval">
        <Descriptions.Item label="Approver">{record.approver || '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Remarks">{record.remarks || '\u2014'}</Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default AdjustmentViewDrawer;
