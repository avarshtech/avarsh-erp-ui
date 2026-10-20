import { Button, Checkbox, DatePicker, Form, InputNumber, Select, Switch } from 'antd';
import dayjs from 'dayjs';
import { NO_WHAT_IF, WHAT_IF_PRESETS } from '../../engine/simulation/scenarios';

const NEW = '__hypothetical';

/** What to simulate: an order (or a hypothetical one), its quantity, start, lines and the what-ifs. */
export default function ScenarioForm({ snapshot, capacities, scenario, onChange, onOrder }) {
  const orders = snapshot.orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION');
  const lines = capacities.lines.map((l) => ({ value: l.id, label: l.name }));
  const set = (patch) => onChange({ ...scenario, ...patch });
  const preset = (p) => onChange(p.apply({ ...scenario, ...NO_WHAT_IF }, capacities.lines));

  return (
    <Form layout="vertical" size="small" requiredMark={false}>
      <Form.Item label="Order" htmlFor="vf-sim-order">
        <Select id="vf-sim-order" value={scenario.orderNo || NEW} onChange={(v) => onOrder(v === NEW ? null : v)}
          options={[...orders.map((o) => ({ value: o.no, label: `${o.no} · ${o.buyer}` })), { value: NEW, label: 'A hypothetical order' }]} showSearch optionFilterProp="label" />
      </Form.Item>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Form.Item label="Quantity to make" htmlFor="vf-sim-qty">
          <InputNumber id="vf-sim-qty" min={100} step={500} value={scenario.qty} onChange={(v) => set({ qty: v || 100 })} suffix="pcs" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Start" htmlFor="vf-sim-start">
          <DatePicker id="vf-sim-start" allowClear={false} value={dayjs(scenario.startDay)} onChange={(d) => set({ startDay: d.format('YYYY-MM-DD') })} format="D MMM YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </div>
      <Form.Item label="Sewing lines to use">
        <Checkbox.Group role="group" aria-label="Sewing lines to use" options={lines} value={scenario.lineIds} onChange={(ids) => set({ lineIds: ids })} />
      </Form.Item>

      <div style={{ fontWeight: 650, fontSize: 12.5, margin: '4px 0 6px' }}>What if…</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {WHAT_IF_PRESETS.map((p) => <Button key={p.id} size="small" onClick={() => preset(p)}>{p.label}</Button>)}
        <Button size="small" type="link" onClick={() => onChange({ ...scenario, ...NO_WHAT_IF })}>Clear</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
        <Form.Item label="Add a sewing line"><Switch checked={scenario.addLine} onChange={(v) => set({ addLine: v })} aria-label="Add a sewing line" /></Form.Item>
        <Form.Item label="Line unavailable" htmlFor="vf-sim-down">
          <Select id="vf-sim-down" allowClear placeholder="None" value={scenario.lineDown ?? undefined} options={lines} onChange={(v) => set({ lineDown: v ?? null })} />
        </Form.Item>
        <Form.Item label="Line in maintenance" htmlFor="vf-sim-maint">
          <Select id="vf-sim-maint" allowClear placeholder="None" value={scenario.maintenanceLine ?? undefined} options={lines} onChange={(v) => set({ maintenanceLine: v ?? null })} />
        </Form.Item>
        <Form.Item label="Fabric late by" htmlFor="vf-sim-late"><InputNumber id="vf-sim-late" min={0} max={30} value={scenario.fabricDelayDays} onChange={(v) => set({ fabricDelayDays: v || 0 })} suffix="days" style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Capacity change" htmlFor="vf-sim-cap"><InputNumber id="vf-sim-cap" min={-50} max={100} value={scenario.capacityPct} onChange={(v) => set({ capacityPct: v || 0 })} suffix="%" style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Overtime a day" htmlFor="vf-sim-ot"><InputNumber id="vf-sim-ot" min={0} max={6} value={scenario.overtimeHours} onChange={(v) => set({ overtimeHours: v || 0 })} suffix="h" style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="QC rejection" htmlFor="vf-sim-rej"><InputNumber id="vf-sim-rej" min={0} max={30} step={0.5} value={scenario.rejectPct ?? undefined} placeholder={`${capacities.rejectPct} (today)`} onChange={(v) => set({ rejectPct: v ?? null })} suffix="%" style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Urgent order first" htmlFor="vf-sim-urgent"><InputNumber id="vf-sim-urgent" min={0} max={100000} step={500} value={scenario.urgentQty} onChange={(v) => set({ urgentQty: v || 0 })} suffix="pcs" style={{ width: '100%' }} /></Form.Item>
      </div>
    </Form>
  );
}
