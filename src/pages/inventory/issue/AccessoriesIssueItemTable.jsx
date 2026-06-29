import { useMemo } from 'react';
import { Table, InputNumber, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const AccessoriesIssueItemTable = ({ items = [], onItemChange }) => {
  const columns = useMemo(
    () => [
      { title: '#', width: 45, key: 'index', align: 'center', render: (_, __, i) => i + 1 },
      { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', width: 140, align: 'center' },
      { title: 'Description', dataIndex: 'description', key: 'description', width: 220, ellipsis: true, align: 'center' },
      { title: 'Color', dataIndex: 'color', key: 'color', width: 100, align: 'center' },
      { title: 'Size', dataIndex: 'size', key: 'size', width: 80, align: 'center' },
      { title: 'BOM Qty', dataIndex: 'bomQty', key: 'bomQty', width: 100, align: 'center', render: (v) => formatNumber(v) },
      {
        title: 'Available', dataIndex: 'availableStock', key: 'availableStock', width: 100, align: 'center',
        render: (v, record) => (
          <Text style={{ color: (v || 0) < (record.bomQty || 0) ? 'var(--error-color)' : undefined }}>
            {formatNumber(v)}
          </Text>
        ),
      },
      {
        title: 'Issue Qty', dataIndex: 'issueQty', key: 'issueQty', width: 160, align: 'center',
        render: (val, record, i) => (
          <InputNumber
            value={val || null}
            onChange={(v) => onItemChange(i, 'issueQty', v)}
            addonAfter={record.uom || ''}
            placeholder="0"
            controls={false}
            style={{ width: '100%' }}
            min={0}
            max={record.availableStock || 0}
            {...numericInputProps}
          />
        ),
      },
      {
        title: 'Excess / Shortage', key: 'delta', width: 140, align: 'center',
        render: (_, record) => {
          if (record.issueQty == null) return <Text type="secondary">—</Text>;
          const delta = record.issueQty - (record.bomQty || 0);
          if (delta === 0) return <Text type="secondary">—</Text>;
          const positive = delta > 0;
          const color = positive ? 'var(--success-color)' : 'var(--error-color)';
          const sign = positive ? '+' : '';
          return (
            <Text style={{ color, fontWeight: 600 }}>
              {sign}{formatNumber(delta)}
            </Text>
          );
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
      scroll={{ x: 1040 }}
      size="small"
      rowClassName={(record) => (record.availableStock || 0) < (record.bomQty || 0) ? 'row-shortage' : ''}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={5} align="center"><Text strong>Totals</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong>{formatNumber(totals.totalBomQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="center"><Text strong>{formatNumber(totals.totalIssueQty)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
};

export default AccessoriesIssueItemTable;
