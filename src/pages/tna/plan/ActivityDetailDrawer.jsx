import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, Drawer, Row, Skeleton, Space, Tag, Timeline,
} from 'antd';
import {
  ExportOutlined, LockOutlined, FlagOutlined, EditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getActivityDetail } from '../../../services/tna/tnaService';
import {
  CHANGE_TYPE, SOURCE_ROUTES, fmtDate, fmtDateTime, fmtText,
} from '../../../utils/tnaConstants';
import { hasPermission } from '../../../utils/permissions';
import TnaStatusTag from '../components/TnaStatusTag';
import ActivityFacts from './ActivityFacts';
import RecordMilestoneModal from './RecordMilestoneModal';

const auditLine = (r) => {
  const change = r.oldValue ? `${r.field} ${fmtDate(r.oldValue)} → ${fmtDate(r.newValue)}` : `${r.field} ${r.newValue && /^\d{4}-/.test(r.newValue) ? fmtDate(r.newValue) : r.newValue}`;
  return `${fmtDateTime(r.at)} · ${change} · ${fmtText(r.reason) || ''} · ${r.actor}`;
};

/**
 * WF-05 — fully source-linked; replaces "Record Actual". "Report data issue" writes a task, not a plan
 * value (FR-6.4); the three manual milestones (no source record exists) are recorded with remarks.
 */
const ActivityDetailDrawer = ({
  planId, code, orderDate, onClose, onReportIssue, onChanged,
}) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState({ code: null, detail: null });
  const [recording, setRecording] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!code) return undefined;
    let live = true;
    getActivityDetail(planId, code)
      .then((d) => { if (live) setLoaded({ code, detail: d }); })
      .catch(() => message.error('Could not load the activity'));
    return () => { live = false; };
  }, [planId, code, message, reload]);
  const detail = loaded.code === code ? loaded.detail : null;

  const a = detail?.activity;
  const record = a && (a.evidence?.sourceRecord || a.sourceRecord);
  const module = a && (a.evidence?.sourceModule || a.sourceModule);
  const canRecord = a?.isManual && hasPermission('tna', 'update');

  return (
    <Drawer
      open={!!code}
      onClose={onClose}
      size={1040}
      destroyOnHidden
      title={a ? (
        <Space>
          <span>{a.code} · {a.name}</span>
          <TnaStatusTag status={a.status} />
          {a.isManual ? <Tag color="purple">manual milestone</Tag> : <Tag icon={<LockOutlined />}>read-only</Tag>}
        </Space>
      ) : 'Activity'}
    >
      {!detail ? <Skeleton active paragraph={{ rows: 12 }} /> : (
        <Row gutter={20}>
          <Col xs={24} lg={15}><ActivityFacts detail={detail} /></Col>
          <Col xs={24} lg={9}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              title={a.isManual ? 'Recorded on the plan — the ERP holds no source record for it' : 'No editable field appears on this panel'}
              description={a.isManual
                ? 'Record the date it happened with the minutes or reference that show it. Corrections keep the earlier entry in the audit.'
                : `Every value is computed or carried from a source record. To correct anything shown here, correct the underlying transaction in ${module}.`}
            />
            <Space orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
              {canRecord && (
                <Button block type="primary" icon={<EditOutlined />} onClick={() => setRecording(true)}>
                  {a.actualDate ? 'Correct the recorded completion' : 'Record completion'}
                </Button>
              )}
              {!a.isManual && SOURCE_ROUTES[module] && (
                <Button block icon={<ExportOutlined />} onClick={() => navigate(SOURCE_ROUTES[module])}>
                  {record ? `Open ${record} in ${module}` : `Open ${module}`}
                </Button>
              )}
              <Button block icon={<FlagOutlined />} onClick={() => onReportIssue(a.code)}>Report data issue against this source record</Button>
            </Space>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>Activity audit</div>
            <Timeline
              items={detail.audit.map((r, i) => ({
                key: `${r.id}-${i}`,
                color: CHANGE_TYPE[r.changeType]?.color === 'default' ? 'gray' : CHANGE_TYPE[r.changeType]?.color,
                content: <span style={{ fontSize: 12 }}>{auditLine(r)}</span>,
              }))}
            />
          </Col>
        </Row>
      )}
      <RecordMilestoneModal
        planId={planId}
        activity={recording ? a : null}
        orderDate={orderDate}
        onClose={() => setRecording(false)}
        onSaved={() => { setRecording(false); setReload((n) => n + 1); onChanged?.(); }}
      />
    </Drawer>
  );
};

export default ActivityDetailDrawer;
