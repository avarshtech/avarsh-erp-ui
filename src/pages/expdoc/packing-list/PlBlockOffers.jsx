import { Alert, Button, Space, Typography } from 'antd';

const { Text } = Typography;

const unitOf = (o) => ({ packingEntryId: o.packingEntryId, poKey: o.poKey ?? null });
const labelOf = (o) => `${o.packingNo}${o.packingDate ? ` · ${o.packingDate}` : ''} · ${o.cartons} ctn${o.inPlan ? ' · as planned' : ''}`;

/**
 * What Carton Packing has packed for one PO that this draft has not taken: each with
 * Add, and Add all. Offered, never attached on its own — opening a list never changes it.
 * Packing taken off this list by hand shows as "Add back".
 */
const PlBlockOffers = ({ offers = [], removed = [], busy, onAdd }) => {
  const ready = offers.filter((o) => o.bindable);
  if (!offers.length && !removed.length) return null;
  return (
    <Space orientation="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
      {offers.length > 0 && (
        <Alert
          type="info"
          showIcon
          title={`${offers.length} packing ${offers.length === 1 ? 'entry' : 'entries'} for this PO not on the list yet${
            offers.some((o) => o.inPlan) ? ` — ${offers.filter((o) => o.inPlan).length} packed as per the plan` : ''}`}
          description={(
            <Space wrap size={8}>
              {offers.map((o) => (
                <Space key={`${o.packingEntryId}|${o.poKey ?? ''}`} size={4}>
                  <Text>{labelOf(o)}</Text>
                  {o.bindable
                    ? <Button size="small" loading={busy} onClick={() => onAdd([unitOf(o)])}>Add</Button>
                    : <Text type="secondary">{o.blockedReason}</Text>}
                </Space>
              ))}
            </Space>
          )}
          action={ready.length > 1 ? (
            <Button size="small" type="primary" loading={busy} onClick={() => onAdd(ready.map(unitOf))}>Add all</Button>
          ) : null}
        />
      )}
      {removed.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {'Taken off this list: '}
          {removed.map((o) => (
            <Button key={`${o.packingEntryId}|${o.poKey ?? ''}`} type="link" size="small" loading={busy}
              disabled={!o.bindable} onClick={() => onAdd([unitOf(o)])}>
              {`${o.packingNo} — add back`}
            </Button>
          ))}
        </Text>
      )}
    </Space>
  );
};

export default PlBlockOffers;
