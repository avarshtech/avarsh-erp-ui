import { memo } from 'react';
import { Button, Card, Space, Steps, Table, Tag, Typography } from 'antd';
import { optionLabel, OVERRIDE_REASONS } from '../../../utils/jobWorkConstants';
import { formatDate } from '../../../utils/formatters';
import { DATE_TIME_FORMAT } from '../../../utils/uiConstants';

const { Text } = Typography;
const STATUS_COLOR = { REQUESTED: 'warning', AUTHORISED: 'success' };
const formatDateTime = (v) => formatDate(v, DATE_TIME_FORMAT);

/**
 * Approval levels as they stand (CPP §16) and the override log (§10.4, report R-7).
 * `levels` are the level names, `approvals` the recorded ones; `canAuthorise(o)` decides
 * the Authorise button per override, `onAuthorise(o)` runs it.
 */
const JobWorkApprovalPanel = memo(function JobWorkApprovalPanel({ levels = [], approvals = [], overrides = [], lineLabel, canAuthorise, onAuthorise, busy }) {
  const steps = levels.map((name, i) => {
    const a = approvals[i];
    return {
      title: name,
      status: a ? 'finish' : i === approvals.length ? 'process' : 'wait',
      description: a ? <Text type="secondary" style={{ fontSize: 12 }}>{a.by} · {formatDateTime(a.at)}{a.selfApproved ? ' · self-approved (superuser)' : ''}{a.remark ? ` · ${a.remark}` : ''}</Text> : null,
    };
  });
  const columns = [
    { title: 'Line', dataIndex: 'lineKey', render: (k) => lineLabel(k) },
    { title: 'Excess', dataIndex: 'excessQty', align: 'right', width: 80 },
    { title: 'Reason', dataIndex: 'reasonCode', width: 170, render: (c) => optionLabel(OVERRIDE_REASONS, c) },
    { title: 'Justification', dataIndex: 'justification' },
    { title: 'Requested', key: 'req', width: 170, render: (_, o) => `${o.requestedBy} · ${formatDateTime(o.requestedAt)}` },
    {
      title: 'Status', key: 'status', width: 210,
      render: (_, o) => (
        <Space size={4} wrap>
          <Tag color={STATUS_COLOR[o.status]}>{o.status === 'AUTHORISED' ? `Authorised by ${o.authorisedBy}` : 'Awaiting authoriser'}</Tag>
          {o.selfAuthorised && <Tag>self (superuser)</Tag>}
          {canAuthorise(o) && <Button size="small" type="primary" loading={busy} onClick={() => onAuthorise(o)}>Authorise</Button>}
        </Space>
      ),
    },
  ];
  return (
    <Card size="small" title="Approval" style={{ marginBottom: 16 }}>
      {steps.length > 0
        ? <Steps size="small" items={steps} style={{ marginBottom: overrides.length ? 16 : 0 }} />
        : <Text type="secondary">The approval levels are fixed from the PO value when it is submitted.</Text>}
      {overrides.length > 0 && (
        <Table size="small" rowKey="id" pagination={false} dataSource={overrides} columns={columns} scroll={{ x: 900 }} style={{ marginTop: 12 }} />
      )}
    </Card>
  );
});

export default JobWorkApprovalPanel;
