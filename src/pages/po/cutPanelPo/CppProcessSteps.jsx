import { memo, useEffect, useMemo, useState } from 'react';
import { Space, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { getCprAllocation } from '../../../services/bom/cutPanel/cutPanelService';
import { allocationRows } from '../../../utils/jobWorkAllocation';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { jobWorkPoStatusLabel, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

/**
 * Every process step of the requirements on this PO, and which POs cover it (PRD §13.2).
 * Read-only and informational: sequence is never enforced (BR-06, OP-3); a covered step
 * opens its PO, it never creates one.
 */
const CppProcessSteps = memo(function CppProcessSteps({ cprIds, processLabel }) {
  const key = cprIds.join(',');
  const [data, setData] = useState({ key: null, rows: [] });

  useEffect(() => {
    let alive = true;
    Promise.all(key.split(',').map((id) => getCprAllocation(Number(id)))).then((all) => {
      if (!alive) return;
      setData({
        key,
        rows: all.flatMap(({ doc, usage, pos }) => allocationRows('CPR', doc, usage).map((r) => ({
          key: `${doc.id}|${r.label}`, cprNo: doc.cprNo, ...r, children: undefined,
          pos: pos.filter((p) => p.processLabel === r.label && ![S.CANCELLED, S.REJECTED].includes(p.status)),
        }))),
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  const columns = useMemo(() => [
    { title: 'CPR', dataIndex: 'cprNo', width: 150 },
    { title: 'Step', dataIndex: 'steps', width: 70, render: (s) => s.join(', ') },
    { title: 'Process', dataIndex: 'label', render: (l) => (l === processLabel ? <strong>{l} (this PO)</strong> : l) },
    { title: 'Required', dataIndex: 'required', align: 'right', width: 90, render: n },
    { title: "PO'd", dataIndex: 'allocated', align: 'right', width: 90, render: n },
    { title: 'Balance', dataIndex: 'balance', align: 'right', width: 90, render: n },
    {
      title: 'Covered by', dataIndex: 'pos',
      render: (pos) => (pos.length
        ? <Space size={4} wrap>{pos.map((p) => <Tag key={p.id} title={jobWorkPoStatusLabel(p.status)}><Link to={`${JOB_WORK_PO_PATH.CPP}/${p.id}`}>{p.poNo}</Link></Tag>)}</Space>
        : <Text type="secondary">Not allocated</Text>),
    },
  ], [processLabel]);

  if (data.key !== key || !data.rows.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <Text strong>Process steps of these requirements</Text>
      <Table size="small" rowKey="key" pagination={false} dataSource={data.rows} columns={columns} style={{ marginTop: 8 }} scroll={{ x: 800 }} />
    </div>
  );
});

export default CppProcessSteps;
