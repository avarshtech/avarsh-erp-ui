import { useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Input, Modal, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { actionReplan } from '../../../services/tna/tnaService';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const fmt = (d) => dayjs(d).format(DATE_FORMAT);

/** §13.2 — the cascade preview: every date that will move, shown BEFORE commitment. */
const CascadeModal = ({ open, replan, onClose, onActioned }) => {
  const { message } = App.useApp();
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(null);

  useEffect(() => { if (open) setRemarks(''); }, [open]);

  const columns = useMemo(() => [
    { title: 'Activity', dataIndex: 'name', render: (v, r) => <span><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{r.code}</span> {v}</span> },
    { title: 'Current', dataIndex: 'oldDate', width: 115, render: fmt },
    { title: 'Becomes', dataIndex: 'newDate', width: 115, render: (v) => <strong>{fmt(v)}</strong> },
    { title: 'Shift', dataIndex: 'shiftDays', width: 70, align: 'right', render: (v) => <Tag color={v > 0 ? 'orange' : 'green'}>{v > 0 ? `+${v}d` : `${v}d`}</Tag> },
  ], []);

  const act = async (action) => {
    if (action !== 'APPROVE' && !remarks.trim()) { message.warning('Add a remark for the originator'); return; }
    setActing(action);
    try {
      await actionReplan(replan.id, action, { remarks });
      message.success(action === 'APPROVE' ? 'Re-plan approved — cascade applied, new plan version created' : action === 'REJECT' ? 'Re-plan rejected — original dates stand' : 'Returned to originator for revision');
      onActioned();
    } catch (e) {
      message.error(e.message || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (!replan) return null;
  return (
    <Modal
      title={`Re-plan — ${replan.orderNo} · ${replan.activityName}`}
      open={open}
      onCancel={onClose}
      width={640}
      footer={(
        <Space>
          <Button onClick={() => act('RETURN')} loading={acting === 'RETURN'}>Return for revision</Button>
          <Button danger onClick={() => act('REJECT')} loading={acting === 'REJECT'}>Reject</Button>
          <Button type="primary" onClick={() => act('APPROVE')} loading={acting === 'APPROVE'}>Approve & cascade</Button>
        </Space>
      )}
    >
      <div style={{ fontSize: 13, marginBottom: 12 }}>
        <div><strong>{replan.reasonCode}</strong> — {replan.justification}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Raised by {replan.raisedBy} on {fmt(replan.raisedOn)} · {fmt(replan.currentDate)} → <strong>{fmt(replan.proposedDate)}</strong>
        </div>
      </div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12.5 }}
        title={`${replan.cascade.length} downstream date${replan.cascade.length === 1 ? '' : 's'} will move on approval. Completed activities are excluded; the baseline is never rewritten.`}
      />
      <Table rowKey="code" size="small" columns={columns} dataSource={replan.cascade} pagination={false} scroll={{ y: 260 }} />
      <Input.TextArea
        rows={2}
        style={{ marginTop: 12 }}
        placeholder="Approver remarks (required for reject / return)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
    </Modal>
  );
};

export default CascadeModal;
