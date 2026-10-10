import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, DatePicker, Modal, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { EditOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  listMasterVersions, getMasterVersion, createDraftVersion, activateVersion,
} from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import {
  ATTRIBUTION, DAY_TYPE, SOURCE_STATUS, currentUserName, fmtDate,
} from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import ActivityEditModal from './ActivityEditModal';

const { Text } = Typography;
const VERSION_COLOR = { ACTIVE: 'green', DRAFT: 'gold', RETIRED: 'default' };

/** WF-09 — the versioned activity master: one completion event per activity, its threshold and day type. */
const ActivityMasterTab = () => {
  const { message } = App.useApp();
  const [versions, setVersions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [version, setVersion] = useState(null);
  const [editing, setEditing] = useState(null);
  const [approving, setApproving] = useState(false);
  const [effective, setEffective] = useState(null);

  const applyVersions = useCallback((list, pick) => {
    setVersions(list);
    setSelected(pick || list.find((v) => v.status === 'DRAFT')?.id || list.find((v) => v.status === 'ACTIVE')?.id);
  }, []);
  const loadVersions = useCallback((pick) => listMasterVersions().then((list) => applyVersions(list, pick)), [applyVersions]);
  useEffect(() => {
    listMasterVersions().then((list) => applyVersions(list)).catch(() => message.error('Failed to load masters'));
  }, [applyVersions, message]);
  const loadVersion = useCallback(() => { if (selected) getMasterVersion(selected).then(setVersion).catch((e) => message.error(e.message)); }, [selected, message]);
  useEffect(loadVersion, [loadVersion]);

  const isDraft = version?.status === 'DRAFT';
  const canEdit = isDraft && hasPermission('tna-masters', 'update');

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 66, render: (v) => <Text strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{v}</Text> },
    { title: 'Activity', dataIndex: 'name', width: 210 },
    { title: 'Source screen', key: 'src', width: 220, render: (_, a) => <Space size={4} wrap>{a.sourceScreen}{a.sourceStatus !== 'LIVE' && <Tooltip title={a.proposal || a.missingNote}><Tag color={SOURCE_STATUS[a.sourceStatus].color}>{SOURCE_STATUS[a.sourceStatus].label}</Tag></Tooltip>}</Space> },
    { title: 'Completion event', dataIndex: 'completionEvent', width: 220, render: (v, a) => <Tooltip title={a.eventNote}><code style={{ fontSize: 12 }}>{v}</code></Tooltip> },
    { title: 'Threshold', dataIndex: 'threshold', width: 86, align: 'right', render: (v) => (v ? `${v}%` : '—') },
    { title: 'Applicability', key: 'app', width: 230, render: (_, a) => a.applicability.label },
    { title: 'Duration', dataIndex: 'duration', width: 80, align: 'right' },
    { title: 'Day type', dataIndex: 'dayType', width: 96, render: (v) => <Tooltip title={DAY_TYPE[v].hint}><Tag color={DAY_TYPE[v].color}>{DAY_TYPE[v].label}</Tag></Tooltip> },
    { title: 'Gate', dataIndex: 'isGate', width: 60, align: 'center', render: (v) => (v ? 'Yes' : 'No') },
    { title: 'Attribution', dataIndex: 'attribution', width: 190, render: (v) => ATTRIBUTION[v]?.label },
    { title: 'Depends on', dataIndex: 'predecessors', width: 130, render: (p) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{p.join(', ').replace('@CUT_PANEL', 'last cut-panel step').replace('@GARMENT_PROCESS', 'last garment step') || '—'}</span> },
    ...(canEdit ? [{ title: '', key: 'e', width: 50, fixed: 'right', render: (_, a) => <Button size="small" type="text" icon={<EditOutlined />} aria-label={`Edit ${a.code}`} onClick={() => setEditing(a)} /> }] : []),
  ], [canEdit]);

  const newDraft = async () => {
    try { const d = await createDraftVersion(); await loadVersions(d.id); } catch (e) { message.error(e.message); }
  };
  const approve = async () => {
    try {
      await activateVersion(version.id, { effectiveFrom: (effective || dayjs(version.effectiveFrom)).format('YYYY-MM-DD'), by: currentUserName() });
      message.success(`Version ${version.versionNo} is active. Plans already generated keep their version.`);
      setApproving(false);
      await loadVersions(version.id);
    } catch (e) { message.error(e.message); }
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select name="masterVersion" style={{ width: 300 }} value={selected} onChange={setSelected} options={versions.map((v) => ({ value: v.id, label: `Version ${v.versionNo} · ${v.status.toLowerCase()} · effective ${fmtDate(v.effectiveFrom)}` }))} />
          {version && <Tag color={VERSION_COLOR[version.status]}>{version.status}</Tag>}
          {version && <Text type="secondary">{versions.find((v) => v.id === version.id)?.plansUsing ?? 0} plans generated with this version</Text>}
        </Space>
        <Space>
          {!versions.some((v) => v.status === 'DRAFT') && hasPermission('tna-masters', 'add') && <Button icon={<PlusOutlined />} onClick={newDraft}>Create draft version</Button>}
          {canEdit && <Button type="primary" icon={<CheckOutlined />} onClick={() => { setEffective(dayjs(version.effectiveFrom)); setApproving(true); }}>Approve version</Button>}
        </Space>
      </Space>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Versioned — a change applies only to plans generated after its effective date and never rewrites an existing plan (FR-12.2)"
        description="Proposed activities resolve through the approved source-screen enhancements (First Bulk Piece sample type, pattern release, marker completion, PP meeting record, order dispatch record). Awaiting-source activities have no event yet; they are reported on Exceptions and are never reopened for manual entry (FR-6.7)."
      />
      <Table rowKey="code" size="small" bordered columns={columns} dataSource={version?.activities || []} pagination={false} scroll={{ x: 1700, y: 520 }} />
      <ActivityEditModal versionId={version?.id} activity={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadVersion(); }} />
      <Modal open={approving} title={`Approve master version ${version?.versionNo}`} okText="Approve" onOk={approve} onCancel={() => setApproving(false)} destroyOnHidden>
        <p>Plans generated on or after the effective date use this version. Plans already generated keep the version they were generated with.</p>
        <DatePicker name="effectiveFrom" format={DATE_FORMAT} value={effective} onChange={setEffective} allowClear={false} />
      </Modal>
    </div>
  );
};

export default ActivityMasterTab;
