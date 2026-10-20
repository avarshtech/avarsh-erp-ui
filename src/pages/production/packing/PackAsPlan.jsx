import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, Modal, Space, Typography,
} from 'antd';
import { listOpenPlansForOrder } from '../../../services/expdoc/expDocService';
import { rowsToPack, rangesText, subtractRanges } from '../../../utils/expDocPlanMatch';
import { poKey, poRefOf, poText } from '../../../utils/expDocPoKeys';
import { PACKING_TYPE_LABELS } from '../../../utils/expDocConstants';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';

const { Text } = Typography;

// Rows filled from a plan get ids from a counter, never the clock
let packSeq = 0;
const nextPackId = () => { packSeq += 1; return `pack-${packSeq}`; };

const optionKey = (o) => `${o.plId}|${o.plan.id}|${o.from}-${o.to}`;

// A grid range naming the plan's PO without a destination is still that PO's
const ofPlanPo = (g, key) => key == null || poKey(g) === key
  || (!poText(g.destination) && poText(g.buyerPoNo) === poRefOf(key).buyerPoNo);

/**
 * "Pack as per packing list" (owner, 2026-10-09): when the buyer's plan came first, the
 * packing lists (in this browser) that plan cartons for this order offer them here. Ticking
 * today's ranges fills the grid with the planned contents, PO and the buyer's carton
 * numbers; the packer enters the real weights and saves as usual.
 */
const PackAsPlan = ({
  orderId, groups = [], refreshKey, onFill,
}) => {
  // The answer is kept with its order, so one for an order no longer picked never shows
  const [answer, setAnswer] = useState({ orderId: null, rows: [] });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    listOpenPlansForOrder(orderId)
      .then((rows) => { if (alive) setAnswer({ orderId, rows }); })
      .catch(() => { if (alive) setAnswer({ orderId, rows: [] }); });
    return () => { alive = false; };
  }, [orderId, refreshKey]);
  const plans = useMemo(() => (answer.orderId === orderId ? answer.rows : []), [answer, orderId]);

  // Ranges already in this entry's grid (filled, not yet saved) are not offered twice
  const options = useMemo(() => plans.flatMap((pl) => pl.rows.flatMap(({ plan, toPack }) => {
    const inGrid = groups.filter((g) => ofPlanPo(g, plan.poKey))
      .map((g) => ({ from: Number(g.cartonFrom), to: Number(g.cartonTo) }));
    return subtractRanges(toPack, inGrid).map((r) => ({ plId: pl.plId, plNo: pl.plNo, plan, from: r.from, to: r.to }));
  })), [plans, groups]);

  if (!options.length) return null;
  const toPackCount = options.reduce((n, o) => n + (o.to - o.from + 1), 0);
  const fill = () => {
    const chosen = options.filter((o) => picked.includes(optionKey(o)));
    onFill(chosen.flatMap((o) => rowsToPack(o.plan, [{ from: o.from, to: o.to }], nextPackId)));
    setOpen(false);
    setPicked([]);
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={`${[...new Set(plans.map((p) => p.plNo))].join(', ')} ${plans.length > 1 ? 'plan' : 'plans'} ${toPackCount} carton(s) of this order still to pack`}
        description="The buyer's packing list came first: pack its cartons with its numbers and PO."
        action={<Button size="small" type="primary" onClick={() => setOpen(true)}>Pack as per packing list</Button>}
      />
      <Modal
        open={open}
        title="Pack as per packing list"
        width={MODAL_WIDTHS.LARGE}
        okText="Fill the grid"
        okButtonProps={{ disabled: !picked.length }}
        onOk={fill}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">Tick the planned ranges packed today.</Text>
          <Checkbox.Group
            name="pack-as-plan"
            value={picked}
            onChange={setPicked}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            options={options.map((o) => ({
              value: optionKey(o),
              label: `${o.plNo} · ${rangesText([{ from: o.from, to: o.to }])} · PO ${o.plan.buyerPoNo || '—'} · ${
                PACKING_TYPE_LABELS[o.plan.packingType] || o.plan.packingType}${o.plan.colorName ? ` · ${o.plan.colorName}` : ''}`,
            }))}
          />
        </Space>
      </Modal>
    </>
  );
};

export default PackAsPlan;
