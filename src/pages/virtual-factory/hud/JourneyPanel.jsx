import { Button, Space, Steps, Tag } from 'antd';
import { AimOutlined, CloseOutlined, ExperimentOutlined } from '@ant-design/icons';
import { formatQty, round } from '../engine/util';
import { RISK, STAGE_LABEL } from './tokens';

const STATUS = { done: 'finish', active: 'process', blocked: 'error', pending: 'wait' };

/** Following one customer order through the factory: where it is now and every step it takes. */
export default function JourneyPanel({ journey, onClose, onShow, onSimulate }) {
  const { order, progress, steps } = journey;
  const risk = RISK[progress.risk] || RISK.unknown;
  return (
    <section className="vf-panel" aria-label={`Following order ${order.no}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="vf-ticket-kind">Following customer order</div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{order.no}</h2>
          <div className="vf-ticket-party">{order.buyer}{order.style ? `, ${order.style}` : ''}</div>
        </div>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Stop following" />
      </div>

      <div style={{ margin: '10px 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Now in <strong>{STAGE_LABEL[progress.current]}</strong></span>
        <Tag color={risk.color} variant="filled" style={{ marginInlineEnd: 0 }}>{risk.label}</Tag>
      </div>
      <div className="vf-stitch" role="progressbar" aria-label="Overall progress" aria-valuenow={Math.round(progress.overallPct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${Math.min(100, progress.overallPct)}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        <span>{progress.currentQty ? `${formatQty(progress.currentQty)} / ${formatQty(order.qty)} pcs at this stage` : `${formatQty(order.qty)} pcs`}</span>
        <span>{round(progress.overallPct)}% overall</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Delivery {order.due || 'not set'}{progress.daysToDue != null ? ` (${progress.daysToDue} days)` : ''}{order.destination ? ` to ${order.destination}` : ''}
      </div>

      <Steps
        orientation="vertical"
        size="small"
        current={-1}
        items={steps.map((s) => ({ title: `${s.icon} ${s.title}`, content: [s.detail, s.extra].filter(Boolean).join(' · '), status: STATUS[s.state] }))}
      />
      <Space style={{ marginTop: 6 }} wrap>
        <Button size="small" icon={<AimOutlined />} onClick={onShow}>Show on the floor</Button>
        <Button size="small" icon={<ExperimentOutlined />} onClick={onSimulate}>Simulate this order</Button>
      </Space>
    </section>
  );
}
