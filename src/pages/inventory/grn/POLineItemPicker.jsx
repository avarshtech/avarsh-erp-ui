import { memo, useMemo, useEffect } from 'react';
import { Card, Table, Empty, Tag, Space, Typography, Tooltip } from 'antd';
import { ProfileOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';
import { matchesGrnCategory } from '../../../utils/inventoryConstants';

const { Text } = Typography;

const POLineItemPicker = memo(function POLineItemPicker({
  category, // GRN_CATEGORY.FABRIC | GRN_CATEGORY.ACCESSORIES
  poLineItems = [],
  selectedIds = [],
  onSelectionChange,
  readOnly = false,
}) {
  // Fabric lines are received as rolls, everything else as cartons. Categories are
  // user-defined master data ("Local Trims", "Imported Trims", "Packing Materials"),
  // so this classifies rather than exact-matching one name.
  const filtered = useMemo(
    () => poLineItems.filter((li) => matchesGrnCategory(li.categoryName, category)),
    [poLineItems, category],
  );

  const columns = useMemo(
    () => [
      // The variant is the purchasable identity, so it stands in for the item code here.
      { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 170, render: (v, r) => <span style={{ whiteSpace: 'nowrap' }}>{r.variantCode || '—'}</span> },
      { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
      { title: 'UOM', dataIndex: 'uom', align: 'center', width: 70 },
      { title: 'PO Qty', dataIndex: 'orderedQty', align: 'center', width: 100, render: (v) => formatNumber(v, 1) },
      { title: 'Received Qty', dataIndex: 'receivedQty', align: 'center', width: 120, render: (v) => formatNumber(v, 1) },
      {
        title: 'Balance',
        dataIndex: 'pendingQty',
        align: 'center',
        width: 130,
        render: (v, record) => {
          if (record.fullyReceived || (v != null && v <= 0)) {
            return (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>
                Fully Received
              </Tag>
            );
          }
          return <Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(v, 1)}</Text>;
        },
      },
      { title: 'Rate', dataIndex: 'rate', align: 'center', width: 100, render: (v) => formatNumber(v, 2) },
    ],
    [],
  );

  // Single-line shortcut: when the PO has exactly ONE eligible line item, hide the
  // checkbox UI entirely and treat the row as auto-included. The form is told via the
  // useEffect below that ensures `selectedIds` already contains that single id.
  const isSingleLine = filtered.length === 1;

  const rowSelection = useMemo(() => {
    if (isSingleLine) return null; // no checkbox column at all
    return {
      selectedRowKeys: selectedIds,
      onChange: (keys) => onSelectionChange?.(keys),
      getCheckboxProps: (r) => {
        const isFullyReceived = r.fullyReceived || (r.pendingQty != null && r.pendingQty <= 0);
        return {
          disabled: readOnly || isFullyReceived,
        };
      },
      renderCell: (checked, record, index, originNode) => {
        const isFullyReceived = record.fullyReceived || (record.pendingQty != null && record.pendingQty <= 0);
        if (isFullyReceived) {
          return (
            <Tooltip title="This line item has been fully received in earlier GRNs">
              <span>{originNode}</span>
            </Tooltip>
          );
        }
        return originNode;
      },
    };
  }, [selectedIds, onSelectionChange, readOnly, isSingleLine]);

  // Auto-include the only line item when there's exactly one (and it isn't fully received)
  useEffect(() => {
    if (!isSingleLine) return;
    const only = filtered[0];
    const isFullyReceived = only?.fullyReceived || (only?.pendingQty != null && only.pendingQty <= 0);
    if (isFullyReceived) return;
    if (!selectedIds.includes(only.id)) {
      onSelectionChange?.([only.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSingleLine, filtered]);

  // Card title differs by mode: single-line shows "Items", multi-line keeps the explicit picker label
  const cardTitle = (
    <Space>
      <ProfileOutlined />
      <span>{isSingleLine ? 'Items' : 'Select PO Line Items'}</span>
      <Tag color="blue">{category}</Tag>
    </Space>
  );

  return (
    <Card
      size="small"
      style={{ marginBottom: 24 }}
      title={cardTitle}
      extra={
        isSingleLine
          ? null
          : <Text type="secondary" style={{ fontSize: 12 }}>{selectedIds.length} of {filtered.length} selected</Text>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        rowSelection={rowSelection}
        pagination={false}
        size="small"
        scroll={{ x: 850 }}
        locale={{
          emptyText: <Empty description={`No ${category.toLowerCase()} line items in this PO`} />,
        }}
      />
    </Card>
  );
});

export default POLineItemPicker;
