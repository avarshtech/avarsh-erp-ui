import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Row, Col, Card, Typography, Tag, Skeleton, Spin, Modal, Input, Button, Alert } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ViewDialog from '../../components/ViewDialog';
import StatusTag from '../../components/StatusTag';
import StatusSteps from '../../components/StatusSteps';
import DraftWatermark from '../../components/DraftWatermark';
import { ActionButton } from '../../components/buttons';
import { SR_STATUS_CONFIG, SR_STATUS_FLOW_BASE } from '../../utils/statusConfig';
import {
  SR_STATUS, getSrStatusLabel, SR_PRIORITY_OPTIONS, canReviseSrDeadline, srRevisionLabel,
} from '../../utils/sampleRequestConstants';
import { hasPermission } from '../../utils/permissions';
import { formatDate } from '../../utils/formatters';
import { toastUnlessHandled } from '../../utils/apiError';
import {
  getSampleRequest, changeStatus, deleteSampleRequest, updateInstructions, raiseSrRevision,
} from '../../services/sr/srService';
import SectionHeader from './form/SectionHeader';
import ViewMaterials from './view/ViewMaterials';
import DeadlinesPanel from './view/DeadlinesPanel';
import ReviseDeadlineDialog from './view/ReviseDeadlineDialog';
import AvailableActionsPanel from './view/AvailableActionsPanel';
import InvoicePanel from './view/InvoicePanel';
import ActivityLogPanel from './view/ActivityLogPanel';
import DispatchInfoCard from './view/DispatchInfoCard';
import FeedbackSummaryCard from './view/FeedbackSummaryCard';

const { Text, Title } = Typography;

const TERMINALS = [SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED];

const SampleRequestView = ({ open, srId, onClose, onChanged, onOpenSr }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [sr, setSr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [instrModal, setInstrModal] = useState({ open: false, specialInstructions: '', remarks: '', saving: false });
  const [reviseOpen, setReviseOpen] = useState(false);

  // Raising a revision creates a document, so it is gated like create, not edit
  const canAdd = hasPermission('sample-requests', 'add');
  const canUpdate = hasPermission('sample-requests', 'update');
  const canDelete = hasPermission('sample-requests', 'delete');
  // The issue screen lives in Inventory and carries its own permission
  const canIssue = hasPermission('inventory-issue', 'add');

  const load = useCallback(async (id) => {
    if (id == null) return;
    setLoading(true);
    try {
      setSr(await getSampleRequest(id));
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load sample request');
      onClose?.();
    } finally { setLoading(false); }
  }, [message, onClose]);

  useEffect(() => { if (open && srId != null) load(srId); }, [open, srId, load]);

  const refresh = useCallback(async () => {
    await load(srId);
    onChanged?.();
  }, [load, srId, onChanged]);

  // Never render a stale record: reopening on a different SR keeps the old one
  // in state until its fetch resolves, so gate every read on the id matching.
  const fresh = sr && sr.id === Number(srId) ? sr : null;

  // Decided by the server against the company's own country, not in the browser
  const overseas = Boolean(sr?.overseas);

  const statusFlow = useMemo(() => {
    if (!sr) return SR_STATUS_FLOW_BASE;
    const terminal = TERMINALS.includes(sr.status) ? sr.status : 'OUTCOME';
    return [...SR_STATUS_FLOW_BASE, terminal];
  }, [sr]);

  const getStepDescription = useCallback((status) => {
    const hit = (sr?.statusHistory || []).find((h) => h.status === status);
    if (hit) return `${formatDate(hit.date)} · ${hit.user}`;
    if (status === 'OUTCOME') return 'Approved / Rejected / Revision Required';
    return undefined;
  }, [sr]);

  const doTransition = useCallback((target, label) => {
    modal.confirm({
      title: `${label}?`,
      content: `${sr?.srNo} → ${getSrStatusLabel(target)}. Every status change is logged with user and timestamp.`,
      onOk: async () => {
        try {
          await changeStatus(sr.id, target, sr.version);
          message.success(`${sr.srNo} → ${getSrStatusLabel(target)}`);
          refresh();
        } catch (e) { toastUnlessHandled(message, e, 'Transition failed'); }
      },
    });
  }, [sr, modal, message, refresh]);

  const handlers = useMemo(() => ({
    onEdit: () => { onClose?.(); navigate(`/sample-requests/edit/${sr?.id}`); },
    onSubmit: () => doTransition(SR_STATUS.SUBMITTED, 'Submit sample request'),
    onReturnToDraft: () => doTransition(SR_STATUS.DRAFT, 'Return to Draft for edits'),
    // Fabric first: it is the document that is normally raised first, and the
    // trims one is a toggle away on the register the form returns to.
    onGoMaterialIssue: () => { onClose?.(); navigate(`/inventory/issue/sample/fabric/new?srId=${sr?.id}`); },
    onGoDispatches: () => { onClose?.(); navigate('/sample-requests/dispatches/list'); },
    onGoComments: () => { onClose?.(); navigate(`/sample-requests/comments?srId=${sr?.id}`); },
    // The new draft needs its own dates before it can be submitted, so land on it
    onRaiseRevision: () => modal.confirm({
      title: `Raise revision ${(sr?.revisionNo ?? 0) + 1} of ${sr?.srNo}?`,
      content: 'A new Draft sample request is created against the same order and sample type, linked to this one. Header, colours and mandatory marks carry over; the deadlines start blank.',
      okText: 'Raise Revision',
      onOk: async () => {
        try {
          const created = await raiseSrRevision(sr.id);
          message.success(`${created.srNo} raised as revision ${created.revisionNo} of ${sr.srNo}`);
          onChanged?.();
          onClose?.();
          navigate(`/sample-requests/edit/${created.id}`);
        } catch (e) { toastUnlessHandled(message, e, 'Failed to raise revision'); }
      },
    }),
    onDelete: () => modal.confirm({
      title: 'Delete Sample Request',
      content: `Delete ${sr?.srNo}? Only Draft SRs can be deleted.`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSampleRequest(sr.id);
          message.success(`${sr.srNo} deleted`);
          onChanged?.();
          onClose?.();
        } catch (e) { toastUnlessHandled(message, e, 'Failed to delete'); }
      },
    }),
  }), [sr, doTransition, modal, message, navigate, onChanged, onClose]);

  const detailsRows = sr ? [
    ['Sample Type', <Tag color="purple" key="t" style={{ whiteSpace: 'nowrap' }}>{sr.sampleTypeName}</Tag>],
    ['Substitution', sr.colourSubstitutionAllowed ? <Tag color="green" key="s">Allowed</Tag> : <Tag key="s">Not allowed</Tag>],
    ['Quantity', `${sr.sampleQty ?? '—'} pcs per size`],
    ['Sizes', (sr.sizes || []).join(' · ') || '—'],
    ['Colour / Print Ref', sr.colourReference || '—'],
    ['Priority', SR_PRIORITY_OPTIONS.find((p) => p.value === sr.priority)?.label || sr.priority],
  ] : [];

  return (
    <>
      <ViewDialog
        open={open}
        onClose={onClose}
        width={1240}
        // No `loading` — ViewDialog would swap children for a generic blob and
        // the structured skeleton below (which mirrors this layout) would never paint
        hero={fresh ? {
          title: sr.srNo,
          status: (
            <>
              <StatusTag status={sr.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
              {srRevisionLabel(sr) && (
                <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                  {srRevisionLabel(sr)}
                  {sr.parentSrNo && (
                    <>
                      {' · of '}
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, height: 'auto', fontSize: 'inherit' }}
                        onClick={() => onOpenSr?.(sr.parentSrId)}
                      >
                        {sr.parentSrNo}
                      </Button>
                    </>
                  )}
                </Tag>
              )}
              {sr.priority === 'URGENT' && <Tag color="red">Urgent</Tag>}
              {overseas && <Tag color="purple">overseas</Tag>}
            </>
          ),
          subtitle: [sr.styleNo, sr.garmentName, sr.buyerName, sr.season].filter(Boolean).join(' • '),
          highlight: { label: 'Sample Type', value: sr.sampleTypeName },
        } : { title: 'Sample Request' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <ActionButton action="close" text="Close" onClick={onClose} />
          </div>
        }
      >
        {!fresh ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton.Input key={i} active size="small" style={{ width: 96 }} block={false} />
              ))}
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
                  <Row gutter={[24, 16]}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Col xs={12} sm={8} key={i}>
                        <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                        <Skeleton.Input active block />
                      </Col>
                    ))}
                  </Row>
                </Card>
                <Card size="small">
                  <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
                  <Skeleton active title={false} paragraph={{ rows: 4 }} />
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[1, 2, 3].map((i) => (
                    <Card size="small" key={i}>
                      <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2 }} />
                    </Card>
                  ))}
                </div>
              </Col>
            </Row>
          </>
        ) : (
          <Spin spinning={loading && Boolean(sr)} tip="Refreshing…">
          <DraftWatermark status={sr.status}>
            <div style={{ marginBottom: 20 }}>
              <StatusSteps
                statusFlow={statusFlow}
                currentStatus={sr.status}
                statusConfig={{ ...SR_STATUS_CONFIG, OUTCOME: {} }}
                getLabel={(s) => (s === 'OUTCOME' ? 'Outcome' : getSrStatusLabel(s))}
                getDescription={getStepDescription}
                size="small"
              />
            </div>
            {/*
              Whether a sample counts as overseas decides whether a commercial
              invoice gates its dispatch. Both halves of that comparison can be
              missing, and silently treating an unknown as domestic is how a
              shipment leaves without its customs paperwork — so say so.
            */}
            {sr.companyCountryMissing && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Company country not configured"
                description="Set the country on Admin → Company Profile. Until then every buyer counts as domestic, so no sample dispatch will ask for a commercial invoice."
              />
            )}
            {sr.buyerCountryMissing && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`No shipping location on record for ${sr.buyerName || 'this buyer'}`}
                description="Add an active shipping location to the buyer. Without a country this sample is treated as domestic and will dispatch without a commercial invoice."
              />
            )}
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <SectionHeader srNo={sr.srNo} header={sr} />
                <Card
                  size="small"
                  title={<Title level={5} style={{ margin: 0 }}>Sample Details</Title>}
                  extra={sr.status === SR_STATUS.IN_PRODUCTION && canUpdate && (
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setInstrModal({
                        open: true,
                        specialInstructions: sr.specialInstructions || '',
                        remarks: sr.remarks || '',
                        saving: false,
                      })}
                    >
                      Edit instructions
                    </Button>
                  )}
                >
                  <Row gutter={[24, 16]}>
                    {detailsRows.map(([label, value]) => (
                      <Col xs={12} sm={8} key={label}>
                        <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{label}</Text>
                        <Text strong style={{ fontSize: 14 }}>{value}</Text>
                      </Col>
                    ))}
                  </Row>
                  {sr.specialInstructions && (
                    <div style={{ marginTop: 14 }}>
                      <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Special Instructions</Text>
                      <Text>{sr.specialInstructions}</Text>
                    </div>
                  )}
                  {sr.remarks && (
                    <div style={{ marginTop: 10 }}>
                      <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Remarks</Text>
                      <Text>{sr.remarks}</Text>
                    </div>
                  )}
                </Card>
                <ViewMaterials sr={sr} />
              </Col>
              <Col xs={24} lg={8}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <DeadlinesPanel
                    sr={sr}
                    onRevise={canUpdate && canReviseSrDeadline(sr.status) ? () => setReviseOpen(true) : undefined}
                  />
                  <AvailableActionsPanel sr={sr} canAdd={canAdd} canUpdate={canUpdate} canDelete={canDelete} canIssue={canIssue} handlers={handlers} />
                  <InvoicePanel sr={sr} overseas={overseas} />
                </div>
              </Col>
              {/* Full width below the materials table — the dispatch grid and the
                  feedback prose are unreadable squeezed into the side column.
                  Both are READ-ONLY here; they are captured on their own screens (R2). */}
              <Col span={24}>
                <DispatchInfoCard sr={sr} />
                <FeedbackSummaryCard sr={sr} />
                <ActivityLogPanel activity={sr.activity} />
              </Col>
            </Row>
          </DraftWatermark>
          </Spin>
        )}
      </ViewDialog>
      {/* Submitted / In Production — the deadlines can be re-agreed; the originals stay as raised */}
      <ReviseDeadlineDialog
        open={reviseOpen}
        sr={fresh}
        onClose={() => setReviseOpen(false)}
        onSaved={() => { setReviseOpen(false); refresh(); }}
      />
      {/* PRD §8.3 — at In Production, Special Instructions + Remarks stay editable */}
      <Modal
        title="Edit instructions"
        open={instrModal.open}
        confirmLoading={instrModal.saving}
        okText="Save"
        onCancel={() => setInstrModal((s) => ({ ...s, open: false }))}
        onOk={async () => {
          setInstrModal((s) => ({ ...s, saving: true }));
          try {
            await updateInstructions(sr.id, {
              specialInstructions: instrModal.specialInstructions,
              remarks: instrModal.remarks,
              version: sr.version,
            });
            message.success('Instructions updated — change logged in the activity trail');
            setInstrModal((s) => ({ ...s, open: false, saving: false }));
            refresh();
          } catch (e) {
            toastUnlessHandled(message, e, 'Failed to update');
            setInstrModal((s) => ({ ...s, saving: false }));
          }
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Header, materials and deadlines are frozen while In Production — only these two fields stay editable.
        </Text>
        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Special Instructions</Text>
        <Input.TextArea
          rows={3}
          value={instrModal.specialInstructions}
          onChange={(e) => setInstrModal((s) => ({ ...s, specialInstructions: e.target.value }))}
          style={{ marginBottom: 12 }}
        />
        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Remarks</Text>
        <Input.TextArea
          rows={2}
          value={instrModal.remarks}
          onChange={(e) => setInstrModal((s) => ({ ...s, remarks: e.target.value }))}
        />
      </Modal>
    </>
  );
};

export default SampleRequestView;
