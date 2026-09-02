import { useState, useEffect, useMemo } from 'react';
import { Alert, App, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { listInvoiceablePls, createInvoice } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const num = (v, dp = 0) => (Number(v) || 0).toLocaleString('en-IN', {
  minimumFractionDigits: dp, maximumFractionDigits: dp,
});

/**
 * Create an export invoice from approved packing lists (§8.1).
 *
 * Ineligible lists are shown greyed WITH the reason rather than hidden — the same
 * idiom the packing-list create modal uses, because "where is my packing list?" is a
 * worse question to leave a user with than "here is why you cannot pick it".
 *
 * §8.1 allows several packing lists on one invoice, but only within one shipment and
 * one buyer: the header carries a single set of transport and consignee blocks, so a
 * mixed selection could not be printed.
 */
const InvoiceCreateModal = ({ open, onCancel, onCreated }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setLoading(true);
    listInvoiceablePls({ size: 200 })
      .then((res) => setRows(res.content || []))
      .catch((e) => { message.error(e.message || 'Failed to load packing lists'); setRows([]); })
      .finally(() => setLoading(false));
  }, [open, message]);

  const chosen = useMemo(() => rows.filter((r) => selected.includes(r.id)), [rows, selected]);

  // Surfaced before the click, not after: the service refuses a mixed selection, and
  // being told why in advance is the difference between a rule and an obstacle.
  const mixedShipment = new Set(chosen.map((c) => c.shipmentId)).size > 1;
  const mixedBuyer = new Set(chosen.map((c) => c.buyerCode)).size > 1;
  const blocker = mixedShipment
    ? 'All packing lists on one invoice must belong to the same shipment.'
    : (mixedBuyer ? 'All packing lists on one invoice must belong to the same buyer.' : null);

  const totals = chosen.reduce((acc, c) => ({
    cartons: acc.cartons + (Number(c.totals?.cartons) || 0),
    pieces: acc.pieces + (Number(c.totals?.pieces) || 0),
  }), { cartons: 0, pieces: 0 });

  const handleCreate = async () => {
    setCreating(true);
    try {
      const inv = await createInvoice({ plIds: selected });
      message.success(`Invoice drafted from ${chosen.map((c) => c.plNo).join(', ')}`);
      onCreated(inv);
    } catch (e) {
      message.error(e.message || 'Could not create the invoice');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: 'PL No', dataIndex: 'plNo', width: 175 },
    { title: 'Buyer', dataIndex: 'buyerName', width: 175, ellipsis: true },
    { title: 'Shipment', dataIndex: 'shipmentNo', width: 155 },
    { title: 'Cartons', dataIndex: 'cartonRangeLabel', width: 130, ellipsis: true },
    {
      title: 'Pieces',
      key: 'pieces',
      width: 95,
      align: 'right',
      render: (_, r) => num(r.totals?.pieces),
    },
    {
      title: '',
      key: 'why',
      width: 260,
      render: (_, r) => (r.eligible
        ? <Tag color="green">Available</Tag>
        : <Tooltip title={r.reason}><Text type="secondary" ellipsis>{r.reason}</Text></Tooltip>),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="New Export Invoice"
      width={MODAL_WIDTHS.LARGE}
      okText="Create invoice"
      onOk={handleCreate}
      confirmLoading={creating}
      okButtonProps={{ disabled: !selected.length || Boolean(blocker) }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="Everything is pulled from the packing list"
          description="Quantities, cartons, weights, CBM and marks come across automatically. Only rate, terms and charges need confirming."
        />
        {blocker && <Alert type="error" showIcon title="These packing lists cannot go on one invoice" description={blocker} />}
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 990, y: 320 }}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (r) => ({ disabled: !r.eligible }),
          }}
          rowClassName={(r) => (r.eligible ? '' : 'expdoc-row-muted')}
          locale={{ emptyText: 'No approved packing lists are waiting to be invoiced.' }}
        />
        {chosen.length > 0 && (
          <Text type="secondary">
            {`${chosen.length} packing list(s) · ${num(totals.cartons)} cartons · ${num(totals.pieces)} pieces`}
          </Text>
        )}
      </Space>
    </Modal>
  );
};

export default InvoiceCreateModal;
