import { useMemo } from 'react';
import { Table, Empty } from 'antd';
import dayjs from 'dayjs';
import { RETURN_TYPE } from '../../../utils/returnToSupplierConstants';
import { formatCurrency } from '../../../utils/formatters';

const qtyWithUom = (qty, uom) => `${Number(qty || 0).toFixed(3)}${uom ? ` ${uom}` : ''}`;

/**
 * Rejected-items table for the Return to Supplier form. Same component serves
 * both Fabric (rolls) and Accessories (size-wise) via the returnType prop.
 * Rows are selected by default (user deselects to exclude), per CRD default.
 */

// All columns: center-aligned + no cell wrap (content stays single-line; table
// scrolls horizontally when total width exceeds the viewport).
const NOWRAP_CELL = { style: { whiteSpace: 'nowrap' } };
const applyStyle = (cols) =>
  cols.map((c) => ({
    align: 'center',
    ellipsis: false,
    ...c,
    onCell: () => NOWRAP_CELL,
    onHeaderCell: () => NOWRAP_CELL,
  }));

const ReturnItemsTable = ({
  returnType,
  rows,
  loading,
  selectedRowKeys,
  onSelectionChange,
}) => {
  const columns = useMemo(() => {
    if (returnType === RETURN_TYPE.FABRIC) {
      return applyStyle([
        { title: 'Roll #', dataIndex: 'rollNumber', width: 110, fixed: 'left' },
        { title: 'Item Code', dataIndex: 'itemCode', width: 140, render: (v, r) => r.variantCode || v || '—' },
        { title: 'Description', dataIndex: 'description' },
        { title: 'GRN #', dataIndex: 'grnNumber', width: 150 },
        { title: 'GRN Date', dataIndex: 'grnDate', width: 120, render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—') },
        { title: 'QC #', dataIndex: 'qcNumber', width: 150 },
        { title: 'Rejected Qty', dataIndex: 'rejectedQty', width: 150, render: (v, r) => qtyWithUom(v, r.uom) },
        { title: 'Unit Price', dataIndex: 'unitPrice', width: 140, render: (v) => formatCurrency(v) },
        { title: 'Line Value', width: 150, render: (_, r) => formatCurrency(Number(r.unitPrice || 0) * Number(r.rejectedQty || 0)) },
        { title: 'Rejection Reason', dataIndex: 'rejectionReason', width: 220 },
      ]);
    }
    return applyStyle([
      { title: 'Item Code', dataIndex: 'itemCode', width: 140, fixed: 'left', render: (v, r) => r.variantCode || v || '—' },
      { title: 'Description', dataIndex: 'description' },
      { title: 'Size', dataIndex: 'size', width: 90 },
      { title: 'Color', dataIndex: 'color', width: 110 },
      { title: 'GRN #', dataIndex: 'grnNumber', width: 150 },
      { title: 'GRN Date', dataIndex: 'grnDate', width: 120, render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—') },
      { title: 'QC #', dataIndex: 'qcNumber', width: 150 },
      { title: 'Rejected Qty', dataIndex: 'rejectedQty', width: 150, render: (v, r) => qtyWithUom(v, r.uom) },
      { title: 'Unit Price', dataIndex: 'unitPrice', width: 140, render: (v) => formatCurrency(v) },
      { title: 'Line Value', width: 150, render: (_, r) => formatCurrency(Number(r.unitPrice || 0) * Number(r.rejectedQty || 0)) },
      { title: 'Rejection Reason', dataIndex: 'rejectionReason', width: 220 },
    ]);
  }, [returnType]);

  const dataSource = useMemo(
    () => rows.map((r) => ({
      ...r,
      key: returnType === RETURN_TYPE.FABRIC ? `roll-${r.qcRollId}` : `crit-${r.qcCriteriaId}`,
    })),
    [rows, returnType]
  );

  return (
    <Table
      size="small"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      rowSelection={{ selectedRowKeys, onChange: onSelectionChange }}
      scroll={{ x: 'max-content', y: 420 }}
      pagination={false}
      locale={{ emptyText: <Empty description="No rejected items pending return for this PO" /> }}
    />
  );
};

export default ReturnItemsTable;
