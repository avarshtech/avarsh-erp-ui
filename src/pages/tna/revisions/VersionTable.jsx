import { memo, useMemo } from 'react';
import { Table, Tag, Tooltip } from 'antd';
import {
  ATTRIBUTION, CHANGE_TYPE, fmtDate, fmtDateTime, fmtText,
} from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';

/**
 * WF-06 version list. Each version is the consequence of a change already approved in its
 * source screen (FR-5.7); T&A does not ask for the decision a second time.
 */
const VersionTable = memo(function VersionTable({ versions, loading }) {
  const columns = useMemo(() => [
    { title: 'Ver', dataIndex: 'versionNo', width: 56, render: (v) => <strong>v{v}</strong> },
    { title: 'Created', dataIndex: 'createdAt', width: 140, render: fmtDateTime },
    { title: 'Trigger event', dataIndex: 'triggerEvent', width: 190, render: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: 'Source record', dataIndex: 'sourceRecord', width: 170 },
    { title: 'Approved in source by', dataIndex: 'approvedInSourceBy', width: 210, ellipsis: true },
    { title: 'Type', dataIndex: 'changeType', width: 150, render: (v) => <Tag color={CHANGE_TYPE[v]?.color}>{CHANGE_TYPE[v]?.label || v}</Tag> },
    {
      title: 'Changed', key: 'changed', width: 100, align: 'right',
      render: (_, v) => (v.changeType === 'GENERATION' ? `${v.activitiesCreated} created` : `${v.activitiesMoved} moved${v.activitiesCreated ? ` +${v.activitiesCreated}` : ''}`),
    },
    { title: 'Projected dispatch', dataIndex: 'projectedAfter', width: 124, render: fmtDate },
    {
      title: 'Δ dispatch', dataIndex: 'deltaDispatch', width: 96, align: 'center',
      render: (v, row) => (row.changeType === 'GENERATION' ? <Tag color="blue">Baseline set</Tag> : <DeltaTag value={v} tip="Change in projected dispatch through the network" />),
    },
    {
      title: 'Attributed to', dataIndex: 'attribution', width: 170,
      render: (v) => (v ? <Tag color={ATTRIBUTION[v]?.color}>{ATTRIBUTION[v]?.label}</Tag> : '—'),
    },
    { title: 'Reason (from source)', dataIndex: 'reason', width: 320, render: (v) => <Tooltip title={fmtText(v)}><span>{fmtText(v)}</span></Tooltip>, ellipsis: true },
  ], []);
  return (
    <Table
      rowKey="versionNo"
      size="small"
      bordered
      loading={loading}
      columns={columns}
      dataSource={versions}
      pagination={false}
      scroll={{ x: 1750, y: 360 }}
    />
  );
});

export default VersionTable;
