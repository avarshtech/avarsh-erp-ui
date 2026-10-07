import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

/** High-priority events as they happen: a new order, a PO approved, a delay, a truck leaving. */
export default function EventToasts({ toasts, onShow, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="vf-toasts" role="status" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className="vf-panel vf-toast">
          <span className="vf-toast-icon" aria-hidden>{t.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vf-row-title">{t.label}{t.demo ? ' (demo data)' : ''}</div>
            <div style={{ fontWeight: 650, fontSize: 14 }}>{t.title}</div>
            {t.detail && <div className="vf-row-detail">{t.detail}</div>}
          </div>
          <Button size="small" color="primary" variant="outlined" onClick={() => { onShow(t); onDismiss(t.id); }}>
            {t.ref?.type === 'order' ? 'Follow' : 'Show'}
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} aria-label="Dismiss" onClick={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
