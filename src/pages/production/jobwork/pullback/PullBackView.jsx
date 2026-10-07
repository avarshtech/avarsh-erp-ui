import { useState } from 'react';
import {
  Alert, App, Button, Space, Tabs, Timeline,
} from 'antd';
import { CheckSquareOutlined, StopOutlined } from '@ant-design/icons';
import { cancelPullBack } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { hasPermission } from '../../../../utils/permissions';
import { PULLBACK_STATUS } from '../../../../utils/jobWorkTracker/constants';
import ReasonModal from '../components/ReasonModal';
import { fmtDate } from '../jwFormat';
import MockApprovalBar from './MockApprovalBar';
import PullBackHeader from './PullBackHeader';
import PullBackPayCard from './PullBackPayCard';
import PullBackReturnsCard from './PullBackReturnsCard';
import PoPrefillPreview from './PoPrefillPreview';
import ReturnDrawer from './ReturnDrawer';
import VendorReturnDrawer from './VendorReturnDrawer';
import SettleModal from './SettleModal';

const KEY = 'production-job-work';
const ACTION_TEXT = {
  SUBMITTED: 'Sent for approval', APPROVED: 'Approved', REJECTED: 'Rejected', REFERRED_BACK: 'Referred back', SETTLED: 'Settled', CANCELLED: 'Cancelled',
};
const ACTION_COLOR = { APPROVED: 'green', SETTLED: 'green', REJECTED: 'red', REFERRED_BACK: 'orange', CANCELLED: 'gray' };

/** A pull-back past the request: approval (simulated), lines and pay, goods back, in-house POs, history. */
const PullBackView = ({ pb, actions, refresh }) => {
  const { message } = App.useApp();
  const [returnFor, setReturnFor] = useState(undefined);
  const [vendorReturn, setVendorReturn] = useState(false);
  const [settling, setSettling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { changed } = actions;
  const approved = pb.status === PULLBACK_STATUS.APPROVED;
  const pending = pb.status === PULLBACK_STATUS.PENDING_APPROVAL;
  const canCancel = (approved || pending) && hasPermission(KEY, 'cancel');
  const rejected = pb.status === PULLBACK_STATUS.REJECTED && [...pb.history].reverse().find((h) => h.action === 'REJECTED');

  const doCancel = async (reason) => {
    const res = await cancelPullBack(pb.id, { reason });
    message.success(`${pb.pbNo} cancelled.`);
    if (res.warning) message.warning(res.warning);
    changed();
  };

  const history = [
    { key: 'raised', color: 'blue', title: `${fmtDate(pb.requestedAt)} · ${pb.requestedBy}`, content: 'Raised' },
    ...pb.history.map((h, i) => ({
      key: `${h.action}-${i}`, color: ACTION_COLOR[h.action] || 'blue', title: `${fmtDate(h.at)} · ${h.by}`,
      content: `${ACTION_TEXT[h.action] || h.action}${h.comment ? ` — ${h.comment}` : ''}`,
    })),
  ];
  const tabs = [
    { key: 'lines', label: 'Lines & pay', children: <PullBackPayCard pb={pb} /> },
    { key: 'returns', label: `Goods back (${pb.returns.length})`, children: <PullBackReturnsCard pb={pb} onRecord={setReturnFor} onVendorReturn={() => setVendorReturn(true)} onChanged={changed} /> },
    { key: 'po', label: `In-house POs${pb.draftPos.length ? ` (${pb.draftPos.length})` : ''}`, children: <PoPrefillPreview pb={pb} refresh={refresh} onChanged={changed} /> },
    { key: 'history', label: 'History', children: <Timeline items={history} style={{ marginTop: 8 }} /> },
  ];

  return (
    <>
      <PullBackHeader pb={pb} onOpenJob={() => actions.openJob(pb.job.id)} />
      {pending && <MockApprovalBar pb={pb} onDone={changed} />}
      {pending && pb.warnings.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="The vendor may have moved on since the request — approval cuts the most-advanced lines first if so."
          description={pb.warnings.map((w) => w.message).join(' ')} />
      )}
      {rejected && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={`Rejected by ${rejected.by}`} description={rejected.comment} />}
      {approved && pb.allArrived && <Alert type="success" showIcon style={{ marginBottom: 12 }} title="Everything approved is back." />}
      {(canCancel || (approved && !pb.allArrived)) && (
        <Space style={{ marginBottom: 8 }} wrap>
          {approved && !pb.allArrived && <Button icon={<CheckSquareOutlined />} disabled={!hasPermission(KEY, 'receive')} onClick={() => setSettling(true)}>Settle what never arrived</Button>}
          {canCancel && <Button danger icon={<StopOutlined />} onClick={() => setCancelling(true)}>Cancel pull-back</Button>}
        </Space>
      )}
      <Tabs items={tabs} />
      {returnFor !== undefined && <ReturnDrawer pb={pb} ret={returnFor} onClose={() => setReturnFor(undefined)} onSaved={changed} />}
      {vendorReturn && (
        <VendorReturnDrawer jobId={pb.job.id} pullBackId={pb.id} title={`Vendor material return — ${pb.pbNo}`} onClose={() => setVendorReturn(false)} onSaved={changed} />
      )}
      {settling && <SettleModal pb={pb} onClose={() => setSettling(false)} onDone={() => { setSettling(false); changed(); }} />}
      {cancelling && (
        <ReasonModal title={`Cancel ${pb.pbNo}`} okText="Cancel pull-back" required={approved} placeholder="Why is this pull-back being cancelled?"
          onSubmit={doCancel} onClose={() => setCancelling(false)}>
          {approved && <Alert type="warning" showIcon title="Allowed only while nothing has come back and no in-house PO is linked. The vendor's plan is restored, and its earlier date too if no sheet changed it since." />}
        </ReasonModal>
      )}
    </>
  );
};

export default PullBackView;
