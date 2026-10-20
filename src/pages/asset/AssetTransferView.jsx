import { useEffect, useState } from 'react';
import { App, Card, Descriptions, Spin, Steps, Table, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { toastUnlessHandled } from '../../utils/apiError';
import {
  approveTransfer, cancelTransfer, completeTransfer, dispatchTransfer,
  getTransfer, rejectTransfer, submitTransfer,
} from '../../services/asset/transferService';
import { conditionMeta, transferStatusMeta } from '../../utils/assetConstants';
import DecisionDialog from './components/DecisionDialog';
import { TRANSFER_DECISIONS } from './components/decisionCopy';
import TransferReceiptDialog from './components/TransferReceiptDialog';
import TransferActionBar from './components/TransferActionBar';
import { printAssetChallan } from '../../utils/assetChallanPrint';
import { companyForPrint } from '../../utils/printCompany';

const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');
const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '-');

/** Where the request has got to. An intra-unit move skips the journey. */
const stepsFor = (t) => {
  const all = t.interUnit
    ? ['DRAFT', 'SUBMITTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED']
    : ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED'];
  const labels = {
    DRAFT: 'Drafted', SUBMITTED: 'Submitted', APPROVED: 'Approved',
    IN_TRANSIT: 'In transit', COMPLETED: 'Completed',
  };
  const reached = all.indexOf(t.status);
  return {
    current: reached < 0 ? all.length : reached,
    // Rejected and cancelled are not points on the line; the banner says so.
    status: ['REJECTED', 'CANCELLED'].includes(t.status) ? 'error' : 'process',
    items: all.map((s) => ({ title: labels[s] })),
  };
};

/**
 * One transfer, and every button the state machine currently allows.
 *
 * The buttons come from the server's own allowedActions rather than being
 * worked out again here, so the screen cannot offer something it is about to
 * be refused for.
 */
const AssetTransferView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // The fetch lives in the effect and the flag is set only in its callbacks:
  // setState in an effect body cascades renders, which the lint rejects. The
  // ignore flag drops an answer for a transfer the user has navigated away from.
  useEffect(() => {
    let ignore = false;
    getTransfer(id)
      .then((loaded) => { if (!ignore) setTransfer(loaded); })
      .catch((e) => { if (!ignore) toastUnlessHandled(message, e, 'Could not load the transfer'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id, message]);

  const run = async (fn, successText) => {
    try {
      setTransfer(await fn());
      message.success(successText);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not do that');
    }
  };

  const submit = () => modal.confirm({
    title: 'Send for approval?',
    content: 'The assets are locked against other transfers until this is decided.',
    okText: 'Submit',
    onOk: () => run(() => submitTransfer(id, transfer.version), 'Sent for approval'),
  });

  /** The document the driver carries and the receiving unit signs. */
  const printChallan = async () => {
    const org = await companyForPrint();
    if (!printAssetChallan(transfer, org)) {
      message.warning('Your browser blocked the print window - allow pop-ups for this site.');
    }
  };

  const steps = transfer ? stepsFor(transfer) : null;

  const itemColumns = [
    { title: 'Asset ID', dataIndex: 'assetCode', width: 170 },
    { title: 'Name', dataIndex: 'assetName' },
    { title: 'Brand / model', key: 'make', width: 160, render: (_, r) => [r.brand, r.model].filter(Boolean).join(' ') || '-' },
    { title: 'Serial no.', dataIndex: 'serialNo', width: 140, render: (v) => v || '-' },
    { title: 'Left from', dataIndex: 'fromLocationText', width: 220 },
    {
      title: 'Sent in',
      dataIndex: 'conditionSent',
      width: 110,
      render: (v) => <Tag color={conditionMeta(v).color}>{conditionMeta(v).label}</Tag>,
    },
    {
      title: 'Arrived',
      key: 'arrival',
      width: 160,
      // Blank until somebody confirms: an empty cell here means "not yet",
      // which is different from "arrived in unknown condition".
      render: (_, r) => {
        if (!r.receiptResult) return <span style={{ opacity: 0.45 }}>awaiting receipt</span>;
        if (r.receiptResult === 'NOT_RECEIVED') return <Tag color="red">Not received</Tag>;
        return <Tag color={conditionMeta(r.conditionReceived).color}>{conditionMeta(r.conditionReceived).label}</Tag>;
      },
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '-' },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={transfer?.transferNo ?? 'Transfer'}
        subtitle={transfer && `${transfer.fromUnitName} → ${transfer.toLocationText}`}
        status={transfer && (
          <Tag color={transferStatusMeta(transfer.status).color}>
            {transferStatusMeta(transfer.status).label}
          </Tag>
        )}
        onBack={() => navigate('/assets/transfers')}
      >
        <TransferActionBar
          transfer={transfer}
          onEdit={() => navigate(`/assets/transfers/${id}/edit`)}
          onSubmit={submit}
          onDialog={setDialog}
          onReceive={() => setReceiptOpen(true)}
          onPrintChallan={printChallan}
        />
      </PageHeader>

      <Spin spinning={loading}>
        {transfer && (
          <>
            <Card>
              <Steps size="small" current={steps.current} status={steps.status} items={steps.items} />
              {!transfer.interUnit && (
                <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
                  This move stays inside {transfer.fromUnitName}, so there is no journey and no challan.
                </div>
              )}
            </Card>

            <Card title="The move" style={{ marginTop: 16 }}>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
                items={[
                  { key: 'from', label: 'From', children: transfer.fromUnitName },
                  { key: 'to', label: 'To', span: 2, children: transfer.toLocationText },
                  { key: 'reason', label: 'Reason', children: transfer.reasonLabel ?? '-' },
                  { key: 'planned', label: 'Planned', children: date(transfer.plannedDate) },
                  { key: 'custodian', label: 'Custodian on arrival', children: transfer.toCustodianName ?? '-' },
                  {
                    key: 'challanNo',
                    label: 'Challan no.',
                    children: transfer.challanNo ?? (transfer.interUnit ? '-' : 'not needed'),
                  },
                  { key: 'vehicle', label: 'Vehicle', children: transfer.vehicleNo ?? '-' },
                  { key: 'notes', label: 'Notes', children: transfer.reasonText ?? '-' },
                ]}
              />
            </Card>

            <Card title="Who did what" style={{ marginTop: 16 }}>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  { key: 'raised', label: 'Raised', children: stamp(transfer.requestedAt) },
                  { key: 'decided', label: 'Decided', children: stamp(transfer.approvedAt) },
                  { key: 'dispatched', label: 'Dispatched', children: stamp(transfer.dispatchedAt) },
                  { key: 'received', label: 'Received', children: stamp(transfer.receivedAt) },
                  { key: 'decisionNote', label: 'Decision note', span: 2, children: transfer.decisionReason ?? '-' },
                ]}
              />
            </Card>

            <Card title={`Assets (${transfer.items.length})`} style={{ marginTop: 16 }}>
              <Table
                columns={itemColumns}
                dataSource={transfer.items}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </Card>

            <DecisionDialog
              action={dialog}
              record={transfer}
              docNo={transfer.transferNo}
              copy={TRANSFER_DECISIONS}
              onClose={() => setDialog(null)}
              onDone={(saved) => { setTransfer(saved); setDialog(null); }}
              handlers={{
                approve: approveTransfer,
                reject: rejectTransfer,
                cancel: cancelTransfer,
                dispatch: dispatchTransfer,
                complete: completeTransfer,
              }}
            />
            <TransferReceiptDialog
              open={receiptOpen}
              transfer={transfer}
              onClose={() => setReceiptOpen(false)}
              onDone={(saved) => { setTransfer(saved); setReceiptOpen(false); }}
            />
          </>
        )}
      </Spin>
    </div>
  );
};

export default AssetTransferView;
