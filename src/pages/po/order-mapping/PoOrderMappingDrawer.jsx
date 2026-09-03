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
    } catch (e) {
      message.error(e.message || 'Could not load purchase order');
    } finally {
      setLoading(false);
    }
  }, [poId, message]);

  useEffect(() => { if (open) load(); else setPo(null); }, [open, load]);

  const applyUpdate = useCallback((updated) => { setPo(updated); onChanged?.(); }, [onChanged]);

  const handleAdd = useCallback(async (values) => {
    try {
      applyUpdate(await addAllocation({ poId, ...values }));
      message.success('Mapped to order');
    } catch (e) {
      message.error(e.message || 'Could not map quantity');
      throw e;
    }
  }, [poId, applyUpdate, message]);

  const handleRemove = useCallback(async (allocationId) => {
    try {
      applyUpdate(await removeAllocation({ poId, allocationId }));
      message.success('Mapping removed');
    } catch (e) {
      message.error(e.message || 'Could not remove mapping');
    }
  }, [poId, applyUpdate, message]);

  const hasOpenQty = (po?.lineItems || []).some((l) => l.unmappedQty > 0);
  const hasAllocations = (po?.lineItems || []).some((l) => l.allocations.length > 0);
  const head = po || summary;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1000}
      title={head ? <Space>{head.poNumber}<StatusTag status={head.mappingStatus} config={PO_ORDER_MAPPING_STATUS_CONFIG} getLabel={getMappingStatusLabel} /></Space> : 'Order Mapping'}
      extra={po && canEdit && (
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

          {po.stockOnly ? (
            <Alert type="warning" showIcon icon={<InboxOutlined />} style={{ marginBottom: 16 }}
              message="Stock Only — deliberately not mapped to any order"
              description={po.stockOnlyRemark} />
          ) : (
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="What mapping does"
              description="Mapped quantity is tagged to the order and its style, so Material Issue for that order can pick this stock and the order's material cost includes it. Unmapped quantity stays as free stock under the PO reference." />
          )}

          <PoMappingLineTable lines={po.lineItems} canEdit={canEdit && !po.stockOnly} onAdd={handleAdd} onRemove={handleRemove} />
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
                    <Text type="secondary" style={{ fontSize: 12 }}>{h.by} · {h.at}</Text>
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
