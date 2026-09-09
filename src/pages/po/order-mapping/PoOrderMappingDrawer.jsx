import { useCallback, useEffect, useState } from 'react';
import { Drawer, Descriptions, Alert, Button, Space, Typography, Skeleton, Timeline, Tag, App, Divider } from 'antd';
import { LinkOutlined, InboxOutlined, UndoOutlined } from '@ant-design/icons';
import { getPoMapping, addAllocation, removeAllocation } from '../../../services/po/poOrderMappingService';
import { PO_STATUS_CONFIG, PO_ORDER_MAPPING_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getStatusLabel as getPoStatusLabel } from '../../../utils/poStatusConstants';
import { getMappingStatusLabel } from '../../../utils/poOrderMappingConstants';
import { formatDate } from '../../../utils/formatters';
import StatusTag from '../../../components/StatusTag';
import PoMappingLineTable from './PoMappingLineTable';
import MapWholePoModal from './MapWholePoModal';
import StockOnlyModal from './StockOnlyModal';

const { Text } = Typography;

/**
 * Workspace for one General PO: header facts, per-line allocations, and the mapping
 * history. `summary` is the list row that opened the drawer, so the title shows the
 * PO number and mapping status immediately instead of flashing a generic label.
 */
const PoOrderMappingDrawer = ({ open, poId, summary, canEdit, onClose, onChanged }) => {
  const { message } = App.useApp();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapAllOpen, setMapAllOpen] = useState(false);
  const [stockOnlyOpen, setStockOnlyOpen] = useState(false);

  const load = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      setPo(await getPoMapping(poId));
    } catch {
      // axiosInstance already raised the server's message as a toast.
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => { if (open) load(); else setPo(null); }, [open, load]);

  const applyUpdate = useCallback((updated) => { setPo(updated); onChanged?.(); }, [onChanged]);

  // The interceptor already toasts the server's message on failure, so these only
  // report success. handleAdd still rethrows, so AllocationAdder keeps the values the
  // user typed instead of clearing a form the server rejected.
  const handleAdd = useCallback(async (values) => {
    applyUpdate(await addAllocation({ poId, ...values }));
    message.success('Mapped to order');
  }, [poId, applyUpdate, message]);

  const handleRemove = useCallback(async (allocationId) => {
    try {
      applyUpdate(await removeAllocation({ poId, allocationId }));
      message.success('Mapping removed');
    } catch {
      // Already reported by the interceptor.
    }
  }, [poId, applyUpdate, message]);

  const hasOpenQty = (po?.lineItems || []).some((l) => l.unmappedQty > 0);
  const hasAllocations = (po?.lineItems || []).some((l) => l.allocations.length > 0);
  const overAllocated = (po?.lineItems || []).filter((l) => l.overAllocatedQty > 0);
  const editable = canEdit && !po?.readOnly;
  const head = po || summary;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1000}
      title={head ? <Space>{head.poNumber}<StatusTag status={head.mappingStatus} config={PO_ORDER_MAPPING_STATUS_CONFIG} getLabel={getMappingStatusLabel} /></Space> : 'Order Mapping'}
      extra={po && editable && (
        <Space>
          <Button icon={po.stockOnly ? <UndoOutlined /> : <InboxOutlined />} disabled={!po.stockOnly && hasAllocations} onClick={() => setStockOnlyOpen(true)}>
            {po.stockOnly ? 'Reopen for mapping' : 'Mark Stock Only'}
          </Button>
          <Button type="primary" icon={<LinkOutlined />} disabled={po.stockOnly || !hasOpenQty} onClick={() => setMapAllOpen(true)}>
            Map entire PO to one order
          </Button>
        </Space>
      )}
    >
      {loading || !po ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}
            items={[
              { key: 'supplier', label: 'Supplier', children: <Text strong>{po.supplierName}</Text> },
              { key: 'poDate', label: 'PO Date', children: formatDate(po.poDate) },
              { key: 'delivery', label: 'Delivery', children: formatDate(po.revisedDeliveryDate || po.deliveryDate) },
              { key: 'status', label: 'PO Status', children: <StatusTag status={po.status} config={PO_STATUS_CONFIG} getLabel={getPoStatusLabel} /> },
              { key: 'type', label: 'PO Type', children: <Tag>{po.poType}</Tag> },
              { key: 'orders', label: 'Linked Orders', children: po.linkedOrders.length ? po.linkedOrders.map((o) => <Tag key={o.orderId} color="blue">{o.orderNo}</Tag>) : <Text type="secondary">None</Text> },
            ]}
          />

          {po.readOnly && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }}
              message={`This PO is ${getPoStatusLabel(po.status)} and can no longer be mapped`}
              description="Its existing mappings are shown below and can still be removed, so nothing is left stranded." />
          )}

          {po.stockOnly ? (
            <Alert type="warning" showIcon icon={<InboxOutlined />} style={{ marginBottom: 16 }}
              message="Stock Only — deliberately not mapped to any order"
              description={po.stockOnlyRemark} />
          ) : (
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="What mapping records"
              description="Which customer orders this PO ended up serving, line by line. Unmapped quantity stays as free stock. Where the PO's delivery date has been re-agreed, that slip carries through to the orders mapped here." />
          )}

          {overAllocated.length > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }}
              message="Mapped for more than has been received"
              description={`${overAllocated.map((l) => l.itemCode).join(', ')}: quantity is mapped against the ordered amount, and goods returned to the supplier do not release it. Check the mapping if the balance looks wrong.`} />
          )}

          {/*
            Removal stays available even on a read-only PO: a referred-back or cancelled PO
            still holds its allocations, and if they could not be cleared here the next edit
            of that line would be refused by the database with nowhere to go.
          */}
          <PoMappingLineTable
            lines={po.lineItems}
            canAdd={editable && !po.stockOnly}
            canRemove={canEdit}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
          {po.hiddenLineCount > 0 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              {po.hiddenLineCount} other line{po.hiddenLineCount === 1 ? '' : 's'} on this PO (packing, consumables) {po.hiddenLineCount === 1 ? 'is' : 'are'} not mapped to orders and {po.hiddenLineCount === 1 ? 'is' : 'are'} hidden here.
            </Text>
          )}

          <Divider titlePlacement="left" plain style={{ marginTop: 24 }}>Mapping history</Divider>
          {po.history.length ? (
            <Timeline
              items={po.history.map((h) => ({
                key: h.id,
                color: h.action === 'Unmapped' ? 'red' : h.action.startsWith('Marked') ? 'orange' : 'green',
                children: (
                  <Space direction="vertical" size={0}>
                    <Text><Text strong>{h.action}</Text> — {h.details}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{h.by} · {formatDate(h.at, 'DD-MMM-YYYY HH:mm')}</Text>
                  </Space>
                ),
              }))}
            />
          ) : <Text type="secondary">No mapping activity yet.</Text>}
        </>
      )}

      <MapWholePoModal open={mapAllOpen} po={po} onClose={() => setMapAllOpen(false)} onMapped={(u) => { setMapAllOpen(false); applyUpdate(u); }} />
      <StockOnlyModal open={stockOnlyOpen} po={po} onClose={() => setStockOnlyOpen(false)} onSaved={() => { setStockOnlyOpen(false); load(); onChanged?.(); }} />
    </Drawer>
  );
};

export default PoOrderMappingDrawer;
