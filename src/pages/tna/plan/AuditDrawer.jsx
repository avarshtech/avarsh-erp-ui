import { useEffect, useState } from 'react';
import { App, Drawer, Empty, Tabs, Tag, Timeline } from 'antd';
import dayjs from 'dayjs';
import { getAuditTrail, getPlanVersions } from '../../../services/tna/tnaService';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const CHANGE_TYPE = {
  AUTO_CAPTURE: { color: 'blue', label: 'Auto-captured' },
  MANUAL_ENTRY: { color: 'default', label: 'Manual entry' },
  APPROVED_REPLAN: { color: 'gold', label: 'Approved re-plan' },
  REGENERATION: { color: 'purple', label: 'Regeneration' },
};

/** §13.3 — immutable audit history + §13.2 version register for one plan. */
const AuditDrawer = ({ open, planId, onClose }) => {
  const { message } = App.useApp();
  const [audit, setAudit] = useState([]);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    if (!open || !planId) return;
    Promise.all([getAuditTrail(planId), getPlanVersions(planId)])
      .then(([a, v]) => { setAudit(a); setVersions(v); })
      .catch(() => message.error('Failed to load audit trail'));
  }, [open, planId, message]);

  const auditItems = audit.map((a) => {
    const t = CHANGE_TYPE[a.changeType] || { color: 'default', label: a.changeType };
    return {
      key: a.id,
      color: a.changeType === 'APPROVED_REPLAN' ? 'orange' : 'blue',
      children: (
        <div style={{ fontSize: 12.5 }}>
          <div>
            <strong>{a.activityCode}</strong> · {a.field} <Tag color={t.color} style={{ fontSize: 10 }}>{t.label}</Tag>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {a.oldValue ? `${dayjs(a.oldValue).format(DATE_FORMAT)} → ` : ''}{dayjs(a.newValue).format(DATE_FORMAT)}
            {a.reasonCode ? ` · ${a.reasonCode}` : ''}{a.sourceRef ? ` · ${a.sourceRef}` : ''}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{a.user} · {a.timestamp}</div>
        </div>
      ),
    };
  });

  return (
    <Drawer title="Audit Trail & Versions" open={open} onClose={onClose} size={460} destroyOnHidden>
      <Tabs
        items={[
          {
            key: 'audit',
            label: `History (${audit.length})`,
            children: audit.length
              ? <Timeline items={auditItems} style={{ marginTop: 8 }} />
              : <Empty description="No changes recorded yet" />,
          },
          {
            key: 'versions',
            label: `Versions (${versions.length + 1})`,
            children: (
              <div>
                {versions.map((v) => (
                  <div key={v.versionNo} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)', fontSize: 12.5 }}>
                    <div><strong>Version {v.versionNo}</strong> · superseded {dayjs(v.generatedOn).format(DATE_FORMAT)}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{v.reasonCode} — {v.justification}</div>
                  </div>
                ))}
                <div style={{ padding: '10px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Version 1 is the frozen baseline (§8.9) — every deviation figure in the system is measured against it.
                </div>
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};

export default AuditDrawer;
