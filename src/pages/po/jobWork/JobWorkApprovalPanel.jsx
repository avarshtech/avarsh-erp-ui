import { memo } from 'react';
import { Button, Card, Space, Table, Tag, Typography } from 'antd';
import ApprovalActionBar from '../../../components/approval/ApprovalActionBar';
import ProductionEngineHistory from '../components/ProductionEngineHistory';
import { optionLabel, OVERRIDE_REASONS } from '../../../utils/jobWorkConstants';
import { formatDate } from '../../../utils/formatters';
import { DATE_TIME_FORMAT } from '../../../utils/uiConstants';

const { Text } = Typography;
const STATUS_COLOR = { REQUESTED: 'warning', AUTHORISED: 'success' };
const formatDateTime = (v) => formatDate(v, DATE_TIME_FORMAT);

/**
 * A job-work PO's approval: the approval engine's history and its level-aware Approve / Reject / Refer Back
 * (decision D1 — the levels are the Approval Flow configured for `entityType`; with none, submit approves at
 * once), and the override / excess log, whose authorisation stays the module's (§10.4, report R-7). Both
 * engine parts re-read whenever the PO's version moves. `buildActionData` / `extraContent` carry a module's
 * own approval input (the Garment Process PO's vendor sign-off); `onDecided` reloads the PO after a decision.
 */
const JobWorkApprovalPanel = memo(function JobWorkApprovalPanel({
  entityType, doc, docLabel, overrides = [], lineLabel, canAuthorise, onAuthorise, busy, buildActionData, extraContent, onDecided,
}) {
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
  const engine = `${doc.id}-${doc.version}`;
  return (
    <Card
      size="small" title="Approval" style={{ marginBottom: 16 }}
      extra={doc.id ? (
        <ApprovalActionBar
          key={engine} entityType={entityType} entityId={doc.id} docLabel={docLabel} docNumber={doc.poNo}
          buildActionData={buildActionData} extraContent={extraContent} onActionComplete={onDecided}
        />
      ) : null}
    >
      {doc.id
        ? <ProductionEngineHistory key={engine} entityType={entityType} entityId={doc.id} />
        : <Text type="secondary">Submitting sends the PO through its approval flow; with no flow configured it is approved at once.</Text>}
      {overrides.length > 0 && (
        <Table size="small" rowKey="id" pagination={false} dataSource={overrides} columns={columns} scroll={{ x: 900 }} style={{ marginTop: 12 }} />
      )}
    </Card>
  );
});

export default JobWorkApprovalPanel;
