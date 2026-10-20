import { Button, Descriptions, Tag } from 'antd';
import { AimOutlined, CloseOutlined } from '@ant-design/icons';
import { describe } from './inspect';

/** Details of whatever was clicked on the floor or picked from a list. */
export default function Inspector({ selection, snapshot, model, insights, onClose, onFollow }) {
  const info = describe(selection, snapshot, model, insights);
  if (!info) return null;
  return (
    <section className="vf-panel" aria-label={`${info.kind} ${info.title}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="vf-ticket-kind">{info.kind}</div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{info.title}</h2>
          {info.subtitle && <div className="vf-ticket-party">{info.subtitle}</div>}
        </div>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Close details" />
      </div>
      {info.tags?.length > 0 && (
        <div style={{ margin: '8px 0 2px' }}>
          {info.tags.map((t) => <Tag key={t.label} color={t.color} variant="filled">{t.label}</Tag>)}
        </div>
      )}
      <Descriptions
        size="small"
        column={1}
        style={{ marginTop: 8 }}
        styles={{ label: { width: 140, color: 'var(--text-secondary)' } }}
        items={info.rows.map(([label, value]) => ({ key: label, label, children: value }))}
      />
      {info.note && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{info.note}</p>}
      {info.order && (
        <Button size="small" icon={<AimOutlined />} style={{ marginTop: 10 }} onClick={() => onFollow(info.order)}>
          Follow order {info.order}
        </Button>
      )}
    </section>
  );
}
