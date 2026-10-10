import { Button, Space, Tag, Typography } from 'antd';
import PlCartonGrid from './PlCartonGrid';
import PlBlockOffers from './PlBlockOffers';
import PlPlanStatus from './PlPlanStatus';
import { poLabelOf } from './plUnitRows';

const { Text } = Typography;

/**
 * One buyer PO of an order block: its cartons (read-only, numbered as they print), the
 * packing entries they came from with Remove on a draft, and what Carton Packing has
 * packed for it that the list could still take.
 */
const PlPoGroup = ({
  po, pl, issuesByRow, editable, busy, onAdd, onRemove, onNotShipping,
}) => (
  <div style={{ marginBottom: 16 }}>
    <Space size={8} wrap style={{ marginBottom: 6 }}>
      <Text strong>{poLabelOf(po)}</Text>
      {po.dispatchDate && <Text type="secondary">{`dispatch ${po.dispatchDate}`}</Text>}
      <Tag>{po.planChip || `${po.totals.cartons} ctn · ${po.totals.pieces.toLocaleString('en-IN')} pcs`}</Tag>
      {!po.onShipment && <Tag color="error">No longer on the shipment</Tag>}
    </Space>
    {po.rows.length > 0 ? (
      <PlCartonGrid section={{ rows: po.rows }} sizes={pl.sizes || []} template={pl.template} issuesByRow={issuesByRow} />
    ) : (
      <Text type="secondary" style={{ display: 'block' }}>No cartons of this PO on the list yet.</Text>
    )}
    {po.units.length > 0 && (
      <Space wrap size={4} style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Packed in</Text>
        {po.units.map((u) => (
          <Tag key={`${u.packingEntryId}|${u.poKey ?? ''}`}>
            {`${u.packingNo}${u.packingDate ? ` · ${u.packingDate}` : ''} · ${u.cartons} ctn`}
            {editable && (
              <Button type="link" size="small" danger loading={busy} style={{ paddingInline: 4, height: 'auto' }}
                onClick={() => onRemove({ packingEntryId: u.packingEntryId, poKey: u.poKey })}>
                Remove
              </Button>
            )}
          </Tag>
        ))}
      </Space>
    )}
    <PlPlanStatus match={po.plan} editable={editable && po.onShipment} busy={busy} onNotShipping={onNotShipping} />
    {editable && <PlBlockOffers offers={po.offers} removed={po.removed} busy={busy} onAdd={onAdd} />}
  </div>
);

export default PlPoGroup;
