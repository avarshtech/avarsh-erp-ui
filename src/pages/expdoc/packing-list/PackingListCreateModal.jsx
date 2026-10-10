import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, App, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { DOC_TYPE } from '../../../utils/expDocConstants';
import {
  listShipmentOptions, listBindableForShipment, createPackingList, getBuyerCommercial,
} from '../../../services/expdoc/expDocService';
import TemplatePickerField from '../shared/TemplatePickerField';
import { unitRowsOf, unplacedText } from './plUnitRows';

const { Text } = Typography;

/**
 * Create a packing list for a shipment (§7.1). It may take nothing yet: the buyer's list
 * can come before the packing, and cartons are added as Carton Packing records them.
 *
 * The cartons offered are the REAL Carton Packing entries of the shipment's orders, one
 * row per entry and buyer PO (a day's packing can serve POs on different shipments), all
 * the free ones ticked. The order's quantities are read from the orders API by the service.
 */
const PackingListCreateModal = ({ open, onCancel, onCreated }) => {
  const { message } = App.useApp();
  const [shipments, setShipments] = useState([]);
  const [shipmentId, setShipmentId] = useState();
  const [bindable, setBindable] = useState({ orders: [], unreadable: false });
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templateId, setTemplateId] = useState();

  useEffect(() => {
    if (!open) return;
    setShipmentId(undefined);
    setBindable({ orders: [], unreadable: false });
    setSelected([]);
    listShipmentOptions().then(setShipments).catch(() => setShipments([]));
  }, [open]);

  useEffect(() => {
    if (!shipmentId) { setBindable({ orders: [], unreadable: false }); setSelected([]); return undefined; }
    // Only the answer for the shipment still picked may land: a slow earlier one must not fill this one
    let alive = true;
    setLoading(true);
    listBindableForShipment(shipmentId)
      .then((res) => {
        if (!alive) return;
        setBindable(res);
        // Every free carton ticked — the common case is "all of it"
        setSelected(unitRowsOf(res.orders).filter((r) => r.bindable).map((r) => r.key));
      })
      .catch((e) => {
        if (!alive) return;
        setBindable({ orders: [], unreadable: false });
        message.error(e.message || 'The packed cartons could not be read');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [shipmentId, message]);

  const shipment = useMemo(() => shipments.find((s) => s.value === shipmentId), [shipments, shipmentId]);
  const rows = useMemo(() => unitRowsOf(bindable.orders), [bindable]);
  const chosen = useMemo(() => rows.filter((r) => selected.includes(r.key)), [rows, selected]);
  const incomplete = chosen.filter((r) => r.bindWarning);
  const unplaced = unplacedText(bindable.orders);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const commercial = getBuyerCommercial({ buyerCode: shipment?.buyerCode });
      const pl = await createPackingList({
        shipmentId,
        templateId,
        buyerId: shipment?.buyerId ?? null,
        buyerCode: shipment?.buyerCode ?? null,
        buyerName: commercial.buyerName ?? shipment?.buyerName ?? null,
        units: chosen.map((r) => ({ packingEntryId: r.packingEntryId, poKey: r.poKey })),
      });
      message.success(`${pl.plNo} created`);
      onCreated(pl);
    } catch (e) {
      message.error(e.message || 'Could not create the packing list');
    } finally {
      setCreating(false);
    }
  }, [chosen, shipmentId, shipment, templateId, message, onCreated]);

  const columns = useMemo(() => [
    { title: 'Order', dataIndex: 'orderNo', width: 150 },
    { title: 'Buyer PO', dataIndex: 'poLabel', width: 200 },
    { title: 'Packing No', dataIndex: 'packingNo', width: 160 },
    { title: 'Packed on', dataIndex: 'packingDate', width: 110 },
    { title: 'Cartons', dataIndex: 'cartons', width: 90, align: 'right', render: (v) => (Number(v) || 0).toLocaleString('en-IN') },
    { title: 'Pieces', dataIndex: 'pieces', width: 100, align: 'right', render: (v) => (Number(v) || 0).toLocaleString('en-IN') },
    {
      // Ineligible rows show the reason rather than vanish, so an expected entry is never a mystery
      title: 'Availability',
      key: 'availability',
      width: 280,
      render: (_, r) => {
        if (!r.bindable) return <Text type="danger">{r.blockedReason}</Text>;
        if (r.bindWarning) return <Tooltip title="Allowed — the packing list records that it took an incomplete entry."><Tag color="gold">{r.bindWarning}</Tag></Tooltip>;
        return <Tag color="green">Ready</Tag>;
      },
    },
  ], []);

  return (
    <Modal
      open={open}
      title="New Packing List"
      width={MODAL_WIDTHS.LARGE}
      okText="Create packing list"
      okButtonProps={{ loading: creating, disabled: !shipmentId || !templateId }}
      onOk={handleCreate}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}><label htmlFor="pl-create-shipment">Shipment</label></Text>
          <FormSelect
            id="pl-create-shipment"
            style={{ width: '100%' }}
            placeholder="Select the shipment this packing list covers"
            options={shipments}
            value={shipmentId}
            onChange={setShipmentId}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            The list takes the cartons of the buyer POs this shipment carries. Carton numbers are checked for duplicates across every packing list of the shipment.
          </Text>
        </div>

        {shipmentId && bindable.unreadable && (
          <Alert type="warning" showIcon title="Packed cartons cannot be read" description="You need Carton Packing view access to see the cartons packed for these orders." />
        )}
        {shipmentId && !loading && !bindable.unreadable && !rows.length && (
          <Alert type="info" showIcon title="Nothing packed yet for this shipment's orders" description="You can still create the packing list now. Cartons are added to it as Carton Packing records them." />
        )}
        {unplaced && <Alert type="warning" showIcon title="Cartons without a buyer PO" description={unplaced} />}

        {shipmentId && rows.length > 0 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Packed cartons to take</Text>
            <Table
              rowKey="key"
              size="small"
              bordered
              className="table-nowrap"
              loading={loading}
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 'max-content', y: 280 }}
              rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: (r) => ({ disabled: !r.bindable }) }}
            />
          </div>
        )}

        {incomplete.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="Taking an incomplete packing entry"
            description={`${[...new Set(incomplete.map((r) => r.packingNo))].join(', ')} is not marked complete. This is allowed, and the packing list flags itself stale if the entry changes afterwards.`}
          />
        )}

        {shipment && (
          <TemplatePickerField
            docType={DOC_TYPE.PACKING_LIST}
            buyerId={shipment.buyerId}
            buyerName={shipment.buyerName}
            value={templateId}
            onChange={setTemplateId}
          />
        )}
      </Space>
    </Modal>
  );
};

export default PackingListCreateModal;
