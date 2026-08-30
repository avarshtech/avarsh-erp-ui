import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Table, Tag, Tooltip } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { listTemplates, listActivities } from '../../../services/tna/tnaService';

/** §7.2 — templates keyed by buyer × product type, global fallback last resort. */
const TemplatesTab = ({ onEdit, refreshKey }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [activities, setActivities] = useState([]);

  const load = useCallback(() => {
    Promise.all([listTemplates(), listActivities()])
      .then(([t, a]) => { setRows(t); setActivities(a); })
      .catch(() => message.error('Failed to load templates'));
  }, [message]);
  useEffect(load, [load, refreshKey]);

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'templateCode', width: 130, render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span> },
    { title: 'Template', dataIndex: 'templateName' },
    { title: 'Buyer', dataIndex: 'buyer', width: 110, render: (v) => v || <Tag>Any</Tag> },
    { title: 'Product Type', dataIndex: 'productType', width: 120, render: (v) => v || <Tag>Any</Tag> },
    {
      title: <Tooltip title="Critical path at 100% scale — derived, governs the % conversion">Critical Path</Tooltip>,
      dataIndex: 'baselineCriticalPath',
      width: 110,
      align: 'right',
      render: (v) => <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{v}d</strong>,
    },
    {
      title: <Tooltip title="Every activity at its floor — orders below this cannot be planned">Floor</Tooltip>,
      dataIndex: 'minFeasibleLeadtime',
      width: 90,
      align: 'right',
      render: (v) => <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--error-color)' }}>{v}d</strong>,
    },
    { title: 'Activities', dataIndex: 'lines', width: 90, align: 'center', render: (v) => v.length },
    { title: 'Status', dataIndex: 'status', width: 100, render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag> },
    { title: 'Ver', dataIndex: 'version', width: 60, align: 'center', render: (v) => `v${v}` },
    { title: '', key: 'a', width: 50, render: (_, r) => <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(r, activities)} /> },
  ], [onEdit, activities]);

  return <Table rowKey="id" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 940 }} />;
};

export default TemplatesTab;
