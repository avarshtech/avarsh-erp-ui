import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, App, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { getOrderByOrderNo } from '../../../services/orders/orderService';
import {
  listShipmentOptions, listBindableForShipment, createPackingList, getBuyerCommercial,
} from '../../../services/expdoc/expDocService';

const { Text } = Typography;

/**
 * Create a packing list: Shipment -> packing entries -> done.
 *
 * The document is created here rather than on a blank form because everything else
 * hangs off the reserved PL number and the bound carton data — the same reason Bill
 * Passing creates its draft in a modal and then opens the workspace on a real record.
 *
 * The ordered breakdown is captured from the REAL order at bind time and snapshotted
 * onto the document, because order-vs-packed must compare against what was ordered,
 * never against packed data (PRD §7.4).
 */
const PackingListCreateModal = ({ open, onCancel, onCreated }) => {
  const { message } = App.useApp();
  const [shipments, setShipments] = useState([]);
  const [shipmentId, setShipmentId] = useState();
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShipmentId(undefined);
    setEntries([]);
    setSelected([]);
    listShipmentOptions().then(setShipments).catch(() => setShipments([]));
  }, [open]);

  useEffect(() => {
    if (!shipmentId) { setEntries([]); setSelected([]); return; }
    setLoading(true);
    listBindableForShipment(shipmentId)
      .then((rows) => {
        setEntries(rows);
        // Pre-select everything that can be bound — the common case is "all of it".
        setSelected(rows.filter((r) => r.bindable).map((r) => r.id));
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  const shipment = useMemo(
    () => shipments.find((s) => s.value === shipmentId),
    [shipments, shipmentId],
  );

  const chosen = useMemo(
    () => entries.filter((e) => selected.includes(e.id)),
    [entries, selected],
  );

  const incomplete = chosen.filter((e) => e.bindWarning);

  /** Ordered quantities per style/colour/size, read from the real order. */
  const buildOrderBreakdown = useCallback(async (orderNos) => {
    const rows = [];
    for (const orderNo of orderNos) {
      let order = null;
      try {
        order = await getOrderByOrderNo(orderNo);
      } catch {
        // A seeded demo entry may reference an order the live API does not have.
        // The document still works; order-vs-packed simply has nothing to compare.
        continue;
      }
      (order?.orderLines || []).forEach((line) => {
        (line.colorRows || []).forEach((cr) => {
          Object.entries(cr.quantities || {}).forEach(([size, qty]) => {
            if (!Number(qty)) return;
            rows.push({
              styleNo: order.styleNo,
              colorName: cr.colorName,
              size,
              orderQty: Number(qty),
            });
          });
        });
      });
    }
    return rows;
  }, []);

  const handleCreate = useCallback(async () => {
    if (!chosen.length) { message.warning('Select at least one packing entry'); return; }
    setCreating(true);
    try {
      // The packing entry snapshots the ordered breakdown when its order is bound,
      // so normally nothing needs fetching here. Only entries without one send us
      // back to the order service.
      const needLookup = chosen.filter((e) => !e.hasOrderBreakdown);
      const orderBreakdown = needLookup.length
        ? await buildOrderBreakdown([...new Set(needLookup.map((e) => e.orderNo).filter(Boolean))])
        : [];
      if (needLookup.length && !orderBreakdown.length) {
        message.info('No ordered breakdown available for these entries — order-vs-packed will be empty.');
      }
      const commercial = getBuyerCommercial({ buyerCode: shipment?.buyerCode });
      const pl = await createPackingList({
        shipmentId,
        buyerCode: shipment?.buyerCode ?? null,
        buyerName: commercial.buyerName ?? null,
        subClientCode: commercial.subClients?.length ? undefined : null,
        packingEntryIds: chosen.map((e) => e.id),
        orderBreakdown,
      });
      message.success(`${pl.plNo} created`);
      onCreated(pl);
    } catch (e) {
      message.error(e.message || 'Could not create the packing list');
    } finally {
      setCreating(false);
    }
  }, [chosen, shipmentId, shipment, buildOrderBreakdown, message, onCreated]);

  const columns = [
    { title: 'Packing No', dataIndex: 'packingNo', width: 170 },
    { title: 'Order', dataIndex: 'orderNo', width: 160 },
    { title: 'Style', dataIndex: 'styleNo', width: 150, ellipsis: true },
    {
      title: 'Cartons',
      dataIndex: 'cartons',
      width: 90,
      align: 'right',
      render: (v) => (Number(v) || 0).toLocaleString('en-IN'),
    },
    {
      title: 'Pieces',
      dataIndex: 'pieces',
      width: 100,
      align: 'right',
      render: (v) => (Number(v) || 0).toLocaleString('en-IN'),
    },
    {
      // Ineligible rows are shown with the reason rather than filtered away, so the
      // user can see why an entry they expected is not on the list.
      title: 'Availability',
      key: 'availability',
      width: 300,
      render: (_, r) => {
        if (!r.bindable) return <Text type="danger">{r.blockedReason}</Text>;
        if (r.bindWarning) return <Tooltip title="Allowed — the packing list records that it bound an incomplete entry."><Tag color="gold">{r.bindWarning}</Tag></Tooltip>;
        return <Tag color="green">Ready</Tag>;
      },
    },
  ];

  return (
    <Modal
      open={open}
      title="New Packing List"
      width={MODAL_WIDTHS.LARGE}
      okText="Create packing list"
      okButtonProps={{ loading: creating, disabled: !chosen.length }}
      onOk={handleCreate}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Shipment</Text>
          <FormSelect
            style={{ width: '100%' }}
            placeholder="Select the shipment this packing list covers"
            options={shipments}
            value={shipmentId}
            onChange={setShipmentId}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Carton numbers are checked for duplicates across every packing list of the shipment.
          </Text>
        </div>

        {shipmentId && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Packing entries to bind</Text>
            <Table
              rowKey="id"
              size="small"
              bordered
              loading={loading}
              columns={columns}
              dataSource={entries}
              pagination={false}
              scroll={{ x: 970, y: 280 }}
              rowSelection={{
                selectedRowKeys: selected,
                onChange: setSelected,
                getCheckboxProps: (r) => ({ disabled: !r.bindable }),
              }}
              locale={{ emptyText: 'No packing entries for this shipment yet.' }}
            />
          </div>
        )}

        {incomplete.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="Binding an incomplete packing entry"
            description={`${incomplete.map((e) => e.packingNo).join(', ')} is not marked complete. This is allowed, and the packing list will flag as stale if the entry changes afterwards.`}
          />
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          The buyer template is resolved automatically from the buyer and sub-client — it is not chosen here.
        </Text>
      </Space>
    </Modal>
  );
};

export default PackingListCreateModal;
