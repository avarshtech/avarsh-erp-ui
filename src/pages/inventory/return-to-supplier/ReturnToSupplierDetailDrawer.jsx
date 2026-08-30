import { useState, useEffect } from 'react';
import { App, Drawer, Descriptions, Table, Tabs, Tag, Skeleton, Empty, Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getReturnById } from '../../../services/inventory/returnToSupplierService';
import { generateReturnDcPdf } from '../../../utils/returnToSupplierPdfGenerator';
import { formatCurrency } from '../../../utils/formatters';
import {
  DEBIT_NOTE_STATUS_COLOR,
  RETURN_STATUS_COLOR,
  RETURN_TYPE_LABEL,
} from '../../../utils/returnToSupplierConstants';

const qtyWithUom = (qty, uom) => `${Number(qty || 0).toFixed(3)}${uom ? ` ${uom}` : ''}`;

const ReturnToSupplierDetailDrawer = ({ returnId, open, onClose }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [data, setData] = useState(null);

  const handlePrint = async () => {
    if (!data) return;
    setPrinting(true);
    try {
      await generateReturnDcPdf(data);
    } catch (e) {
      message.error(e?.message || 'Failed to print Return DC');
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (!open || !returnId) { setData(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getReturnById(returnId);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) message.error(e?.response?.data?.message || 'Failed to load return');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, returnId, message]);

  const NOWRAP_CELL = { style: { whiteSpace: 'nowrap' } };
  const styleCols = (cols) =>
    cols.map((c) => ({
      align: 'center',
      ellipsis: false,
      ...c,
      onCell: () => NOWRAP_CELL,
      onHeaderCell: () => NOWRAP_CELL,
    }));

  const itemColumns = styleCols([
    { title: 'Item Code', dataIndex: 'itemCode', width: 140, render: (v, r) => r.variantCode || v || '—' },
    { title: 'Description', dataIndex: 'description', width: 220 },
    { title: 'Roll/Size', render: (_, r) => r.rollNumber || r.size || '—', width: 120 },
    { title: 'GRN #', dataIndex: 'grnNumber', width: 150 },
    { title: 'QC #', dataIndex: 'qcNumber', width: 150 },
    { title: 'Qty', dataIndex: 'rejectedQty', width: 130, render: (v, r) => qtyWithUom(v, r.uom) },
    { title: 'Unit Price', dataIndex: 'unitPrice', width: 130, render: (v) => formatCurrency(v) },
    { title: 'Line Value', dataIndex: 'lineValue', width: 140, render: (v) => formatCurrency(v) },
    { title: 'Tax', dataIndex: 'taxValue', width: 120, render: (v) => formatCurrency(v) },
    { title: 'Total', dataIndex: 'totalAmount', width: 140, render: (v) => formatCurrency(v) },
  ]);

  const debitNote = data?.debitNote;

  const renderReturnTab = () => (
    <>
      <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Return DC #">{data?.returnNumber}</Descriptions.Item>
        <Descriptions.Item label="Date">{data?.returnDate ? dayjs(data.returnDate).format('DD-MMM-YYYY') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Type">{RETURN_TYPE_LABEL[data?.returnType] || data?.returnType}</Descriptions.Item>
        <Descriptions.Item label="PO Number">{data?.poNumber}</Descriptions.Item>
        <Descriptions.Item label="PO Date">{data?.poDate ? dayjs(data.poDate).format('DD-MMM-YYYY') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Supplier">{data?.supplierName}</Descriptions.Item>
        <Descriptions.Item label="GRN Ref" span={2}>{data?.grnRef || '—'}</Descriptions.Item>
        <Descriptions.Item label="Prepared By">{data?.preparedByName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Subtotal">{formatCurrency(data?.subtotal)}</Descriptions.Item>
        <Descriptions.Item label="Tax Total">{formatCurrency(data?.taxTotal)}</Descriptions.Item>
        <Descriptions.Item label="Grand Total">
          <strong>{formatCurrency(data?.grandTotal)}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Status" span={3}>
          <Tag color={RETURN_STATUS_COLOR[data?.status] || 'default'}>{data?.status}</Tag>
        </Descriptions.Item>
        {data?.remarks && (
          <Descriptions.Item label="Remarks" span={3}>{data.remarks}</Descriptions.Item>
        )}
      </Descriptions>

      <Table
        size="small"
        columns={itemColumns}
        dataSource={(data?.items || []).map((i) => ({ ...i, key: i.id }))}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </>
  );

  const renderDebitTab = () => {
    if (!debitNote) {
      return <Empty description="No debit note found for this return" />;
    }
    return (
      <>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Debit Note #">{debitNote.debitNoteNumber}</Descriptions.Item>
          <Descriptions.Item label="Date">{debitNote.debitNoteDate ? dayjs(debitNote.debitNoteDate).format('DD-MMM-YYYY') : '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={DEBIT_NOTE_STATUS_COLOR[debitNote.status] || 'default'}>{debitNote.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Return #">{debitNote.returnNumber}</Descriptions.Item>
          <Descriptions.Item label="PO #">{debitNote.poNumber}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{debitNote.supplierName}</Descriptions.Item>
          <Descriptions.Item label="Subtotal">{formatCurrency(debitNote.subtotal)}</Descriptions.Item>
          <Descriptions.Item label="Tax Total">{formatCurrency(debitNote.taxTotal)}</Descriptions.Item>
          <Descriptions.Item label="Grand Total">
            <strong>{formatCurrency(debitNote.grandTotal)}</strong>
          </Descriptions.Item>
        </Descriptions>

        <Table
          size="small"
          columns={styleCols([
            { title: 'Item Code', dataIndex: 'itemCode', width: 140, render: (v, r) => r.variantCode || v || '—' },
            { title: 'Description', dataIndex: 'description', width: 220 },
            { title: 'Roll/Size', render: (_, r) => r.rollNumber || r.size || '—', width: 120 },
            { title: 'Qty', dataIndex: 'qty', width: 130, render: (v, r) => qtyWithUom(v, r.uom) },
            { title: 'Unit Price', dataIndex: 'unitPrice', width: 130, render: (v) => formatCurrency(v) },
            { title: 'Line Value', dataIndex: 'lineValue', width: 140, render: (v) => formatCurrency(v) },
            { title: 'Tax', dataIndex: 'taxValue', width: 120, render: (v) => formatCurrency(v) },
            { title: 'Total', dataIndex: 'totalAmount', width: 140, render: (v) => formatCurrency(v) },
          ])}
          dataSource={(debitNote.items || []).map((i) => ({ ...i, key: i.id }))}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </>
    );
  };

  return (
    <Drawer
      title={data ? `Return to Supplier — ${data.returnNumber}` : 'Return to Supplier'}
      open={open}
      onClose={onClose}
      width={1000}
      destroyOnHidden
      extra={
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          loading={printing}
          disabled={!data}
          onClick={handlePrint}
        >
          Print Return DC
        </Button>
      }
    >
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Tabs
          items={[
            { key: 'return', label: 'Return DC', children: renderReturnTab() },
            { key: 'debit', label: 'Debit Note', children: renderDebitTab() },
          ]}
        />
      )}
    </Drawer>
  );
};

export default ReturnToSupplierDetailDrawer;
