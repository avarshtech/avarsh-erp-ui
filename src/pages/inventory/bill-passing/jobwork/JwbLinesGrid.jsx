import { useMemo } from 'react';
import { Table, Typography } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import { formatCurrency, formatNumber } from '../../../../utils/formatters';
import { gridScroll } from '../../../../utils/gridScroll';
import { jwbLineColumns } from './jwbLineColumns';

const { Text } = Typography;
const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
const QTY_KEYS = ['poQty', 'issuedQty', 'returnedQty', 'rejectedReceiptQty', 'rejectedQcQty', 'acceptedQty'];

/**
 * Reconciliation & passing, one row per PO line. A long grid scrolls inside a viewport-high body with its
 * header and totals pinned, the line frozen on the left.
 */
const JwbLinesGrid = ({ bill, readOnly, onLineChange }) => {
  const columns = useMemo(() => jwbLineColumns({ bill, readOnly, onLineChange }), [bill, readOnly, onLineChange]);

  const summary = () => {
    // Totals line up under their columns: quantities in pieces, then the two money columns.
    const cells = columns.map((c, i) => {
      if (QTY_KEYS.includes(c.dataIndex)) return <Table.Summary.Cell key={c.key} index={i} align="right">{formatNumber(sum(bill.lines, c.dataIndex))}</Table.Summary.Cell>;
      if (c.dataIndex === 'shortQty') return <Table.Summary.Cell key={c.key} index={i} align="right">{formatNumber(sum(bill.lines, 'shortQty'))}</Table.Summary.Cell>;
      if (c.dataIndex === 'invoiceAmount' || c.dataIndex === 'passedAmount') {
        return <Table.Summary.Cell key={c.key} index={i} align="right"><strong>{formatCurrency(sum(bill.lines, c.dataIndex))}</strong></Table.Summary.Cell>;
      }
      return <Table.Summary.Cell key={c.key} index={i}>{i === 0 ? <strong>Total</strong> : null}</Table.Summary.Cell>;
    });
    return <Table.Summary fixed="bottom"><Table.Summary.Row>{cells}</Table.Summary.Row></Table.Summary>;
  };

  return (
    <DetailCard
      title="Reconciliation & Passing"
      icon={<TableOutlined />}
      count={bill.lines.length}
      extra={<Text type="secondary" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Quantities in pieces · invoice and passed qty in the PO's billing unit</Text>}
      bare
      style={{ marginBottom: 16 }}
    >
      <Table
        size="small"
        className="table-nowrap"
        rowKey="id"
        columns={columns}
        dataSource={bill.lines}
        pagination={false}
        scroll={gridScroll('max-content', bill.lines.length)}
        summary={summary}
      />
    </DetailCard>
  );
};

export default JwbLinesGrid;
