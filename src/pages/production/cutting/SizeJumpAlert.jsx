import { useMemo } from 'react';
import { Alert, Table, Tag } from 'antd';

/**
 * CR Change 2A — yellow warning panel when Cut Qty exceeds Order Qty:
 * excess pieces jump to the previous (smaller) size; smallest size = wastage.
 */
const SizeJumpAlert = ({ jumps }) => {
  const columns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Cut Qty', dataIndex: 'cutQty', width: 90, align: 'right' },
    { title: 'Order Qty', dataIndex: 'orderQty', width: 90, align: 'right' },
    { title: 'Excess', dataIndex: 'excess', width: 80, align: 'right', render: (v) => <strong style={{ color: 'var(--error-color)' }}>+{v}</strong> },
    { title: 'Action', dataIndex: 'action', width: 100, align: 'center', render: (v) => <Tag color="warning">{v}</Tag> },
    {
      title: 'Jump-To', dataIndex: 'jumpTo', width: 130, align: 'center',
      render: (v) => (v ? <Tag color="blue">Size {v}</Tag> : <span style={{ color: 'var(--text-secondary)' }}>— (excess / wastage)</span>),
    },
  ], []);

  if (!jumps.length) return null;

  return (
    <Alert
      type="warning" showIcon style={{ marginTop: 12 }}
      title="Size Jump — cut quantity exceeds order quantity"
      description={(
        <>
          <Table rowKey="size" size="small" columns={columns} dataSource={jumps} pagination={false} style={{ marginTop: 8 }} />
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            Excess pieces are moved / re-cut to the previous (smaller) size. Every jump is recorded in the size-jump register for traceability and wastage reporting.
          </div>
        </>
      )}
    />
  );
};

export default SizeJumpAlert;
