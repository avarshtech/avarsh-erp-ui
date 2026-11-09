import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, DatePicker, Modal, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { EditOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listTemplates, getTemplate, activateTemplate } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { ATTRIBUTION, DAY_TYPE, fmtDate } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import TemplateActivityModal from './TemplateActivityModal';
import NewTemplateModal from './NewTemplateModal';

const { Text } = Typography;
const STATUS_COLOR = { ACTIVE: 'green', DRAFT: 'gold', RETIRED: 'default' };
const APPLICABILITY = { ALWAYS: 'Every order', WHEN_SOURCE_EXISTS: 'When the order has the source record' };
const scopeOf = (t) => `${t.buyerName || 'All buyers'}${t.garmentType ? ` · ${t.garmentType}` : ''}`;

/** Buyer T&A templates: which milestones apply to a buyer's orders and how long each takes (versioned, FR-12.2). */
const TemplatesTab = () => {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [template, setTemplate] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [effective, setEffective] = useState(dayjs());

  const applyList = useCallback((list, pick) => {
    setTemplates(list);
    setSelected(pick || list.find((t) => t.status === 'DRAFT')?.id || list.find((t) => t.status === 'ACTIVE')?.id || null);
  }, []);
  const loadList = useCallback((pick) => listTemplates().then((list) => applyList(list, pick)), [applyList]);
  useEffect(() => {
    listTemplates().then((list) => applyList(list)).catch(() => message.error('Failed to load T&A templates'));
  }, [applyList, message]);
  const loadTemplate = useCallback(() => {
    if (selected) getTemplate(selected).then(setTemplate).catch(() => message.error('Failed to load the template'));
  }, [selected, message]);
  useEffect(loadTemplate, [loadTemplate]);

  const header = template?.header;
  const canEdit = header?.status === 'DRAFT' && hasPermission('tna-masters', 'update');

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 66, render: (v) => <Text strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{v}</Text> },
    { title: 'Activity', dataIndex: 'name', width: 220, render: (v, a) => <Space size={4}>{v}{a.sourceKind === 'MANUAL' && <Tooltip title="No source record exists — recorded on the plan with remarks"><Tag color="purple">Manual</Tag></Tooltip>}</Space> },
    { title: 'Included', dataIndex: 'included', width: 84, align: 'center', render: (v) => (v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>) },
    { title: 'Applies to', dataIndex: 'applicability', width: 200, render: (v) => APPLICABILITY[v] || v },
    { title: 'Duration', key: 'd', width: 110, align: 'right', render: (_, a) => <Tooltip title={`Catalogue default ${a.defaultDuration} ${a.defaultDayType}`}>{a.duration} {a.dayType}</Tooltip> },
    { title: 'Threshold', dataIndex: 'threshold', width: 86, align: 'right', render: (v) => (v ? `${v}%` : '—') },
    { title: 'Gate', dataIndex: 'gate', width: 60, align: 'center', render: (v) => (v ? 'Yes' : 'No') },
    { title: 'Source screen', dataIndex: 'sourceScreen', width: 220 },
    { title: 'Completes when', dataIndex: 'eventNote', width: 300, ellipsis: { showTitle: true } },
    { title: 'Attribution', dataIndex: 'attribution', width: 180, render: (v) => ATTRIBUTION[v]?.label },
    { title: 'Depends on', dataIndex: 'predecessors', width: 130, render: (p) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{p.join(', ').replace('@CUT_PANEL', 'last cut-panel step').replace('@GARMENT_PROCESS', 'last garment step') || '—'}</span> },
    ...(canEdit ? [{ title: '', key: 'e', width: 50, fixed: 'right', render: (_, a) => <Button size="small" type="text" icon={<EditOutlined />} aria-label={`Edit ${a.code}`} onClick={() => setEditing(a)} /> }] : []),
  ], [canEdit]);

  const approve = async () => {
    try {
      await activateTemplate(header.id, { effectiveFrom: effective.format('YYYY-MM-DD') });
      message.success(`${header.name} v${header.versionNo} is active. Plans already generated keep their template version.`);
      setApproving(false);
      await loadList(header.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Failed to activate the template'); }
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Select name="tnaTemplate" style={{ width: 420 }} value={selected} onChange={setSelected}
            options={templates.map((t) => ({ value: t.id, label: `${scopeOf(t)} — ${t.name} v${t.versionNo} · ${t.status.toLowerCase()}` }))} />
          {header && <Tag color={STATUS_COLOR[header.status]}>{header.status}</Tag>}
          {header && <Text type="secondary">{header.activityCount} activities · {header.plansUsing} plans generated from it{header.effectiveFrom ? ` · effective ${fmtDate(header.effectiveFrom)}` : ''}</Text>}
        </Space>
        <Space>
          {hasPermission('tna-masters', 'add') && <Button icon={<PlusOutlined />} onClick={() => setCreating(true)}>New buyer template</Button>}
          {canEdit && <Button type="primary" icon={<CheckOutlined />} onClick={() => { setEffective(dayjs()); setApproving(true); }}>Activate template</Button>}
        </Space>
      </Space>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="An order gets its buyer's template (buyer + garment type, then buyer), else the default — chosen when the order is confirmed"
        description="Every date is still taken from the source records; a template only decides which milestones apply and how long each is planned to take. Activating a version never rewrites a plan already generated (FR-12.2). Order confirmed and Dispatch are always planned."
      />
      <Table rowKey="code" size="small" bordered columns={columns} dataSource={template?.activities || []} pagination={false} scroll={{ x: 1700, y: 520 }} />
      <TemplateActivityModal templateId={header?.id} activity={editing} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); setTemplate(t); }} />
      <NewTemplateModal open={creating} templates={templates} onClose={() => setCreating(false)} onCreated={(t) => { setCreating(false); loadList(t.header.id); }} />
      <Modal open={approving} title={`Activate ${header?.name} v${header?.versionNo}`} okText="Activate" onOk={approve} onCancel={() => setApproving(false)} destroyOnHidden>
        <p>Orders confirmed from now on that match {header ? scopeOf(header) : ''} are planned with this version; the version it replaces is retired. Plans already generated keep theirs.</p>
        <DatePicker name="templateEffectiveFrom" format={DATE_FORMAT} value={effective} onChange={(d) => setEffective(d || dayjs())} allowClear={false} />
      </Modal>
    </div>
  );
};

export default TemplatesTab;
