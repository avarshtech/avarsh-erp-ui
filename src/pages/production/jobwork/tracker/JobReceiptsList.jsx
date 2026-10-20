import { memo, useState } from 'react';
import {
  App, Button, Input, Popconfirm, Table, Tag, Typography,
} from 'antd';
import { cancelReceipt } from '../../../../services/production/jobwork/jobWorkReceiptApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { ReceiptStatusTag } from '../components/JwTags';
import { fmtDate, fmtQty } from '../jwFormat';

const { Text } = Typography;
const sum = (lines, k) => lines.reduce((a, l) => a + (l[k] || 0), 0);

/** A job's receipts; a posted one can be cancelled with a reason (it stays listed). */
const JobReceiptsList = memo(function JobReceiptsList({ receipts = [], finalStage, canCancel, onChanged }) {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const cancel = async (r) => {
    try {
      await cancelReceipt(r.id, { reason });
      message.success(`${r.receiptNo} cancelled.`);
      setReason('');
      onChanged();
    } catch (e) { toastUnlessHandled(message, e, 'Could not cancel the receipt.'); }
  };
  const columns = [
    { title: 'Receipt', dataIndex: 'receiptNo', render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.receiptDate)} · DC {r.vendorDcNo}</Text></> },
    { title: 'Stage', dataIndex: 'stage', render: (s) => (<>{STAGE_LABEL[s]}{s !== finalStage && <Tag color="gold" style={{ marginLeft: 6 }}>Temporary</Tag>}</>) },
    { title: 'Good', key: 'g', align: 'right', render: (_, r) => fmtQty(sum(r.lines, 'good')) },
    { title: 'Rejected', key: 'x', align: 'right', render: (_, r) => fmtQty(sum(r.lines, 'rejected')) },
    { title: 'Alter', key: 'a', align: 'right', render: (_, r) => fmtQty(sum(r.lines, 'alter')) },
    { title: 'Status', dataIndex: 'status', render: (s, r) => <><ReceiptStatusTag status={s} />{r.cancelReason && <Text type="secondary" style={{ fontSize: 11 }}> {r.cancelReason}</Text>}</> },
    {
      title: '', key: 'act', width: 90,
      render: (_, r) => (canCancel && r.status === 'POSTED' ? (
        <Popconfirm
          title="Cancel this receipt?"
          description={<Input name="receiptCancelReason" size="small" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />}
          okButtonProps={{ disabled: !reason.trim() }}
          onConfirm={() => cancel(r)}
        >
          <Button size="small" danger type="link">Cancel</Button>
        </Popconfirm>
      ) : null),
    },
  ];
  return <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={receipts} locale={{ emptyText: 'Nothing received yet.' }} />;
});

export default JobReceiptsList;
