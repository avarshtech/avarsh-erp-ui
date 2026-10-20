import { useEffect, useMemo, useState } from 'react';
import {
  App, Select, Space, Switch, Table, Typography,
} from 'antd';
import { compareVersions } from '../../../services/tna/tnaService';
import { fmtDate } from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';

const { Text } = Typography;

/** FR-10.3 — any two plan versions side by side: each activity's revised target in both. */
const VersionCompare = ({ planId, versions }) => {
  const { message } = App.useApp();
  const last = versions.length;
  const planKey = `${planId}:${last}`;
  const [chosen, setChosen] = useState({ planKey: null, pair: null });
  const pair = chosen.planKey === planKey ? chosen.pair : [1, last];
  const setPair = (p) => setChosen({ planKey, pair: p });
  const [rows, setRows] = useState([]);
  const [changedOnly, setChangedOnly] = useState(true);
  const [a, b] = pair;

  useEffect(() => {
    if (!last) return;
    compareVersions(planId, a, b).then(setRows).catch((e) => message.error(e.message));
  }, [planId, a, b, last, message]);

  const options = versions.map((v) => ({ value: v.versionNo, label: `v${v.versionNo} · ${v.triggerEvent}` }));
  const shown = useMemo(() => (changedOnly ? rows.filter((r) => r.a !== r.b) : rows), [rows, changedOnly]);
  const columns = [
    { title: 'Activity', key: 'a', render: (_, r) => <span><Text code>{r.code}</Text> {r.name}</span> },
    { title: `Target in v${pair[0]}`, dataIndex: 'a', width: 130, render: fmtDate },
    { title: `Target in v${pair[1]}`, dataIndex: 'b', width: 130, render: fmtDate },
    { title: 'Δ', dataIndex: 'delta', width: 90, align: 'center', render: (v) => <DeltaTag value={v} unit="WD" /> },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select name="versionA" style={{ width: 260 }} value={pair[0]} options={options} onChange={(v) => setPair([v, pair[1]])} />
        <span>against</span>
        <Select name="versionB" style={{ width: 260 }} value={pair[1]} options={options} onChange={(v) => setPair([pair[0], v])} />
        <Switch size="small" checked={changedOnly} onChange={setChangedOnly} aria-label="Changed activities only" />
        <span style={{ fontSize: 12 }}>Changed activities only</span>
      </Space>
      <Table rowKey="code" size="small" bordered columns={columns} dataSource={shown} pagination={false} scroll={{ y: 420 }} locale={{ emptyText: 'No activity target differs between these versions' }} />
    </div>
  );
};

export default VersionCompare;
