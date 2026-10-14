import { useEffect, useState } from 'react';
import { Alert, App, Input, Modal, Select, Table } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';
import { receiveTransfer } from '../../../services/asset/transferService';
import { ASSET_CONDITION, conditionMeta, toOptions } from '../../../utils/assetConstants';

const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);
const RESULT_OPTIONS = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'NOT_RECEIVED', label: 'Not received' },
];

/**
 * The receiving unit confirms what actually turned up.
 *
 * <p>Every line has to be answered, and the condition is asked for each one
 * rather than assumed from what was sent - the difference between the two is
 * damage in transit, and it is the only moment anybody can see it.</p>
 *
 * <p>A line marked Not received does not move. That asset stays recorded where
 * the system last saw it, so a machine that never arrived is not quietly
 * written down as having done so.</p>
 */
const TransferReceiptDialog = ({ open, transfer, onClose, onDone }) => {
  const { message } = App.useApp();
  const [lines, setLines] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !transfer) return;
    // Default to received in the condition it was sent: the common case is a
    // load that arrived intact, and the exceptions are what need typing.
    setLines(transfer.items.map((i) => ({
      itemId: i.id,
      assetCode: i.assetCode,
      assetName: i.assetName,
      conditionSent: i.conditionSent,
      result: 'RECEIVED',
      conditionReceived: i.conditionSent,
      remarks: '',
    })));
    setRemarks('');
  }, [open, transfer]);

  const setLine = (itemId, patch) =>
    setLines((all) => all.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));

  const submit = async () => {
    const missing = lines.find((l) => l.result === 'RECEIVED' && !l.conditionReceived);
    if (missing) {
      message.error(`Say what condition ${missing.assetCode} arrived in.`);
      return;
    }
    setSaving(true);
    try {
      const saved = await receiveTransfer(transfer.id, {
        lines: lines.map(({ itemId, result, conditionReceived, remarks: note }) => ({
          itemId, result, conditionReceived: result === 'RECEIVED' ? conditionReceived : null, remarks: note || null,
        })),
        remarks: remarks || null,
        version: transfer.version,
      });
      message.success(`${transfer.transferNo} received`);
      onDone(saved);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not confirm the receipt');
    } finally {
      setSaving(false);
    }
  };

  const shortCount = lines.filter((l) => l.result === 'NOT_RECEIVED').length;

  const columns = [
    { title: 'Asset', key: 'asset', render: (_, r) => `${r.assetCode} — ${r.assetName}` },
    {
      title: 'Sent in',
      dataIndex: 'conditionSent',
      width: 110,
      render: (v) => conditionMeta(v).label,
    },
    {
      title: 'Arrived?',
      key: 'result',
      width: 150,
      render: (_, r) => (
        <Select
          value={r.result}
          options={RESULT_OPTIONS}
          style={{ width: '100%' }}
          onChange={(v) => setLine(r.itemId, { result: v })}
        />
      ),
    },
    {
      title: 'Condition on arrival',
      key: 'condition',
      width: 170,
      render: (_, r) => (
        <Select
          value={r.result === 'RECEIVED' ? r.conditionReceived : undefined}
          disabled={r.result !== 'RECEIVED'}
          options={CONDITION_OPTIONS}
          placeholder={r.result === 'RECEIVED' ? 'Pick one' : 'n/a'}
          style={{ width: '100%' }}
          onChange={(v) => setLine(r.itemId, { conditionReceived: v })}
        />
      ),
    },
    {
      title: 'Remarks',
      key: 'remarks',
      width: 200,
      render: (_, r) => (
        <Input
          value={r.remarks}
          maxLength={500}
          placeholder={r.result === 'NOT_RECEIVED' ? 'What happened?' : 'Optional'}
          onChange={(e) => setLine(r.itemId, { remarks: e.target.value })}
        />
      ),
    },
  ];

  return (
    <Modal
      title={`Receive ${transfer?.transferNo ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Confirm receipt"
      confirmLoading={saving}
      width={900}
      destroyOnHidden
    >
      {shortCount > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`${shortCount} asset${shortCount === 1 ? '' : 's'} marked as not received`}
          description="Those stay recorded at the sending unit. The rest of the transfer completes."
          style={{ marginBottom: 12 }}
        />
      )}
      <Table
        columns={columns}
        dataSource={lines}
        rowKey="itemId"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 320 }}
      />
      <Input.TextArea
        rows={2}
        value={remarks}
        maxLength={500}
        placeholder="Anything about the delivery as a whole (optional)"
        onChange={(e) => setRemarks(e.target.value)}
        style={{ marginTop: 12 }}
      />
    </Modal>
  );
};

export default TransferReceiptDialog;
