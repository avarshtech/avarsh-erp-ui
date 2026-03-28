import { useMemo } from 'react';
import { Table, InputNumber, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const AccessoriesIssueItemTable = ({ items = [], onItemChange }) => {
  const columns = useMemo(
    () => [
      { title: '#', width: 45, key: 'index', render: (_, __, i) => i + 1 },
      { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 130 },
      { title: 'Description', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
      { title: 'Color', dataIndex: 'color', key: 'color', width: 90 },
      { title: 'Size', dataIndex: 'size', key: 'size', width: 70 },
      { title: 'BOM Qty', dataIndex: 'bomQty', key: 'bomQty', width: 90, align: 'center', render: (v) => formatNumber(v) },
      {
        title: 'Available', dataIndex: 'availableStock', key: 'availableStock', width: 90, align: 'center',
        render: (v, record) => (
          <Text style={{ color: (v || 0) < (record.bomQty || 0) ? 'var(--error-color)' : undefined }}>
            {formatNumber(v)}
          </Text>
        ),
      },
      {
        title: 'Issue Qty', dataIndex: 'issueQty', key: 'issueQty', width: 110,
        render: (val, record, i) => (
          <InputNumber
            value={val}
            onChange={(v) => onItemChange(i, 'issueQty', v)}
            style={{ width: '100%' }}
            min={0}
            max={record.availableStock || 0}
            {...numericInputProps}
          />
        ),
      },
      { title: 'UOM', dataIndex: 'uom', key: 'uom', width: 65 },
      {
        title: 'Shortage', key: 'shortage', width: 90, align: 'center',
        render: (_, record) => {
          const shortage = (record.bomQty || 0) - (record.availableStock || 0);
          return shortage > 0
            ? <Text style={{ color: 'var(--error-color)', fontWeight: 600 }}>{formatNumber(shortage)}</Text>
            : <Text type="secondary">—</Text>;
        },
      },
    ],
    [onItemChange],
  );

  const totals = useMemo(() => ({
    totalBomQty: items.reduce((sum, item) => sum + (item.bomQty || 0), 0),
    totalIssueQty: items.reduce((sum, item) => sum + (item.issueQty || 0), 0),
  }), [items]);

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={items}
      pagination={false}
      scroll={{ x: 1000 }}
      size="small"
      rowClassName={(record) => (record.availableStock || 0) < (record.bomQty || 0) ? 'row-shortage' : ''}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={5}><Text strong>Totals</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong>{formatNumber(totals.totalBomQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="center"><Text strong>{formatNumber(totals.totalIssueQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} colSpan={2} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
};

export default AccessoriesIssueItemTable;
