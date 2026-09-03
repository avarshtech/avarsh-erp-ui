import { memo, useCallback, useMemo, useState } from 'react';
import { App, Col, Divider, Input, List, Row, Select, Space, Tag, Tooltip, Typography, Modal } from 'antd';
import dayjs from 'dayjs';
import ActionButton from '../../../components/buttons/ActionButton';
import ActivityTimeline from '../../../components/ActivityTimeline';
import EmptyState from '../../../components/EmptyState';
import { ISSUE_STATUS, ISSUE_STATUS_COLOR } from '../../../utils/billPassingConstants';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  WITHDRAWN: 'Withdrawn',
};

const stamp = (v) => (v ? dayjs(v).format('DD-MMM-YYYY hh:mm A') : '-');

/** FR-BP-801/802 — every question asked on this bill, and the audit trail beneath it. */
const BpIssueLog = memo(function BpIssueLog({ bill, issueTypes = [], onAdd, onSetStatus, onWithdraw }) {
  const { message } = App.useApp();
  const [newType, setNewType] = useState(undefined);
  const [newText, setNewText] = useState('');
  const [dialog, setDialog] = useState(null);   // { mode: 'resolve' | 'withdraw', issue }
  const [dialogText, setDialogText] = useState('');

  const typeByCode = useMemo(
    () => new Map(issueTypes.map((t) => [t.code, t])),
    [issueTypes],
  );

  // Newest first, but a withdrawn issue keeps its place — it is never removed.
  const issues = useMemo(
    () => [...(bill?.issues || [])].sort(
      (a, b) => dayjs(b.raisedAt).valueOf() - dayjs(a.raisedAt).valueOf() || (b.id || 0) - (a.id || 0),
    ),
    [bill],
  );

  const activities = useMemo(
    () => (bill?.activity || []).map((a) => ({
      id: a.id, type: 'user', user: a.user, action: a.action, details: a.details, timestamp: a.timestamp,
    })),
    [bill],
  );

  const submitAdd = useCallback(() => {
    if (!newType) { message.error('Pick an issue type.'); return; }
    if (newText.trim().length < 5) { message.error('Describe the issue in at least a few words.'); return; }
    onAdd?.({ issueTypeCode: newType, description: newText.trim() });
    setNewType(undefined);
    setNewText('');
  }, [newType, newText, onAdd, message]);

  const submitDialog = useCallback(() => {
    const text = dialogText.trim();
    if (dialog?.mode === 'withdraw' && text.length < 5) {
      message.error('A reason is mandatory to withdraw an issue.');
      return;
    }
    if (dialog?.mode === 'resolve' && text.length < 3) {
      message.error('Record how this issue was resolved.');
      return;
    }
    if (dialog?.mode === 'withdraw') onWithdraw?.(dialog.issue.id, text);
    else onSetStatus?.(dialog.issue.id, ISSUE_STATUS.RESOLVED, text);
    setDialog(null);
    setDialogText('');
  }, [dialog, dialogText, onWithdraw, onSetStatus, message]);

  const renderItem = useCallback((issue) => {
    const type = typeByCode.get(issue.issueTypeCode);
    const withdrawn = issue.status === ISSUE_STATUS.WITHDRAWN;
    return (
      <List.Item
        key={issue.id}
        actions={withdrawn ? [] : [
          issue.status === ISSUE_STATUS.OPEN && (
            <ActionButton key="prog" action="edit" text="Mark In Progress" size="small"
              tooltip="Someone is chasing this"
              onClick={() => onSetStatus?.(issue.id, ISSUE_STATUS.IN_PROGRESS)} />
          ),
          issue.status !== ISSUE_STATUS.RESOLVED && (
            <ActionButton key="res" action="approve" text="Resolve" size="small"
              tooltip="Close this issue with a resolution note"
              onClick={() => { setDialog({ mode: 'resolve', issue }); setDialogText(''); }} />
          ),
          <ActionButton key="wd" action="cancel" text="Withdraw" size="small"
            tooltip="Withdraw with a reason — the issue stays on the log"
            onClick={() => { setDialog({ mode: 'withdraw', issue }); setDialogText(''); }} />,
        ].filter(Boolean)}
      >
        <List.Item.Meta
          title={(
            <Space size={6} wrap>
              <Tooltip title={type?.blocking ? 'An open issue of this type blocks approval' : null}>
                <Tag color={type?.blocking ? 'red' : 'blue'}>{type?.name || issue.issueTypeCode}</Tag>
              </Tooltip>
              <Tag color={ISSUE_STATUS_COLOR[issue.status] || 'default'}>
                {STATUS_LABEL[issue.status] || issue.status}
              </Tag>
              {issue.autoLogged && <Tag color="default">system</Tag>}
            </Space>
          )}
          description={(
            <div>
              <Paragraph
                style={{
                  marginBottom: 4,
                  color: withdrawn ? 'var(--text-secondary)' : undefined,
                  textDecoration: withdrawn ? 'line-through' : 'none',
                }}
              >
                {issue.description}
              </Paragraph>
              {withdrawn && (
                <Text style={{ fontSize: 12, color: 'var(--warning-color)', display: 'block' }}>
                  {`Withdrawn by ${issue.withdrawnBy || '-'} on ${stamp(issue.withdrawnAt)} — ${issue.withdrawReason || 'no reason recorded'}`}
                </Text>
              )}
              {!withdrawn && issue.resolutionRemarks && (
                <Text style={{ fontSize: 12, color: 'var(--success-color)', display: 'block' }}>
                  {`Resolved by ${issue.resolvedBy || '-'} on ${stamp(issue.resolvedAt)} — ${issue.resolutionRemarks}`}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {`Raised by ${issue.raisedBy || '-'} on ${stamp(issue.raisedAt)}`}
              </Text>
            </div>
          )}
        />
      </List.Item>
    );
  }, [typeByCode, onSetStatus]);

  return (
    <>
      <Row gutter={[12, 12]} align="bottom" style={{ marginBottom: 12 }}>
        <Col xs={24} md={7}>
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Issue Type</Text>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            placeholder="Select issue type"
            value={newType}
            onChange={setNewType}
            options={issueTypes.map((t) => ({
              value: t.code,
              label: t.blocking ? `${t.name} (blocks approval)` : t.name,
            }))}
          />
        </Col>
        <Col xs={24} md={13}>
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Description</Text>
          <TextArea
            rows={2}
            maxLength={500}
            showCount
            value={newText}
            placeholder="What is unclear or disputed on this bill"
            onChange={(e) => setNewText(e.target.value)}
          />
        </Col>
        <Col xs={24} md={4}>
          <ActionButton action="create" text="Add Issue" block onClick={submitAdd} />
        </Col>
      </Row>

      <List
        size="small"
        dataSource={issues}
        renderItem={renderItem}
        locale={{
          emptyText: (
            <EmptyState
              title="No issues raised"
              description="Log a question here whenever the invoice, the GRN or the QC result needs clarification before this bill can be passed."
            />
          ),
        }}
      />

      <Divider titlePlacement="start" style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bill activity</Text>
      </Divider>
      <ActivityTimeline activities={activities} emptyText="No activity recorded on this bill yet" />

      <Modal
        open={Boolean(dialog)}
        title={dialog?.mode === 'withdraw' ? 'Withdraw this issue' : 'Resolve this issue'}
        width={480}
        destroyOnHidden
        okText={dialog?.mode === 'withdraw' ? 'Withdraw issue' : 'Resolve issue'}
        okButtonProps={{ danger: dialog?.mode === 'withdraw' }}
        onOk={submitDialog}
        onCancel={() => { setDialog(null); setDialogText(''); }}
      >
        <Text style={{ color: 'var(--text-secondary)' }}>
          {dialog?.mode === 'withdraw'
            ? 'The issue stays on the log struck through, with your reason against it.'
            : 'Record what closed this issue so the approver can see it was settled.'}
        </Text>
        <TextArea
          rows={4}
          autoFocus
          maxLength={300}
          showCount
          value={dialogText}
          style={{ marginTop: 8 }}
          placeholder={dialog?.mode === 'withdraw' ? 'Why this issue is being withdrawn' : 'How this issue was resolved'}
          onChange={(e) => setDialogText(e.target.value)}
        />
      </Modal>
    </>
  );
});

export default BpIssueLog;
