import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Row, Col, Card, Typography, Tag, Skeleton, Spin, Modal, Input, Button } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ViewDialog from '../../components/ViewDialog';
import StatusTag from '../../components/StatusTag';
import StatusSteps from '../../components/StatusSteps';
import DraftWatermark from '../../components/DraftWatermark';
import { ActionButton } from '../../components/buttons';
import { SR_STATUS_CONFIG, SR_STATUS_FLOW_BASE } from '../../utils/statusConfig';
import {
  SR_STATUS, getSrStatusLabel, SR_PRIORITY_OPTIONS,
} from '../../utils/sampleRequestConstants';
import { hasPermission } from '../../utils/permissions';
import { formatDate } from '../../utils/formatters';
import {
  getSampleRequest, changeStatus, deleteSampleRequest, listByOrderNo, isOverseas,
  updateInstructions,
} from '../../services/sr/srService';
import SectionHeader from './form/SectionHeader';
import ViewMaterials from './view/ViewMaterials';
import DeadlinesPanel from './view/DeadlinesPanel';
import AvailableActionsPanel from './view/AvailableActionsPanel';
import InvoicePanel from './view/InvoicePanel';
import RevisionHistoryPanel from './view/RevisionHistoryPanel';
import ActivityLogPanel from './view/ActivityLogPanel';
import DispatchPanel from './view/DispatchPanel';
import BuyerCommentsPanel from './view/BuyerCommentsPanel';
import RaisePoDrawer from './form/RaisePoDrawer';

const { Text, Title } = Typography;

const TERMINALS = [SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED];

const scrollToPanel = (domId) => {
  document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** Walk parent/child links to collect this SR's sample-type chain, oldest first. */
const buildChain = (all, sr) => {
  const byId = new Map(all.map((r) => [r.id, r]));
  let head = sr;
  while (head.parentSrId && byId.has(head.parentSrId)) head = byId.get(head.parentSrId);
  const chain = [];
  let cur = head;
  while (cur) {
    chain.push(cur);
    cur = cur.childSrId ? byId.get(cur.childSrId) : null;
  }
  return chain.length ? chain : [sr];
};

const SampleRequestView = ({ open, srId, onClose, onChanged }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [sr, setSr] = useState(null);
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentId, setCurrentId] = useState(srId);
  const [poDrawer, setPoDrawer] = useState({ open: false, focusLine: null });
  const [instrModal, setInstrModal] = useState({ open: false, specialInstructions: '', remarks: '', saving: false });

  const canUpdate = hasPermission('sample-requests', 'update');
  const canDelete = hasPermission('sample-requests', 'delete');

  useEffect(() => { setCurrentId(srId); }, [srId]);

  const load = useCallback(async (id) => {
    if (id == null) return;
    setLoading(true);
    try {
      const record = await getSampleRequest(id);
      setSr(record);
      const { content } = await listByOrderNo(record.orderNo);
      setChain(buildChain(content, record));
    } catch (e) {
      message.error(e.message || 'Failed to load sample request');
      onClose?.();
    } finally { setLoading(false); }
  }, [message, onClose]);

  useEffect(() => { if (open && currentId != null) load(currentId); }, [open, currentId, load]);

  const refresh = useCallback(async () => {
    await load(currentId);
    onChanged?.();
  }, [load, currentId, onChanged]);

  const overseas = useMemo(() => (sr ? isOverseas(sr) : false), [sr]);

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
          await changeStatus(sr.id, target);
          message.success(`${sr.srNo} → ${getSrStatusLabel(target)}`);
          refresh();
        } catch (e) { message.error(e.message || 'Transition failed'); }
      },
    });
  }, [sr, modal, message, refresh]);

  const handlers = useMemo(() => ({
    onEdit: () => { onClose?.(); navigate(`/sample-requests/edit/${sr?.id}`); },
    onSubmit: () => doTransition(SR_STATUS.SUBMITTED, 'Submit sample request'),
    onStartProduction: () => doTransition(SR_STATUS.IN_PRODUCTION, 'Start production'),
    onReturnToDraft: () => doTransition(SR_STATUS.DRAFT, 'Return to Draft for edits'),
    onGoDispatch: () => scrollToPanel('sr-dispatch-panel'),
    onGoComments: () => scrollToPanel('sr-comments-panel'),
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
        } catch (e) { message.error(e.message || 'Failed to delete'); }
      },
    }),
  }), [sr, doTransition, modal, message, navigate, onChanged, onClose]);

  const detailsRows = sr ? [
    ['Sample Type', <Tag color="purple" key="t">{sr.sampleTypeName}</Tag>],
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
        loading={loading && !sr}
        hero={sr ? {
          title: sr.srNo,
          status: (
            <>
              <StatusTag status={sr.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
              {sr.priority === 'URGENT' && <Tag color="red">Urgent</Tag>}
              {overseas && <Tag color="purple">overseas</Tag>}
            </>
          ),
          subtitle: [sr.styleNo, sr.garmentName, sr.buyerName, sr.season].filter(Boolean).join(' • '),
          highlight: { label: 'Round', value: `R${sr.round || 1} · ${sr.sampleTypeName}` },
        } : { title: 'Sample Request' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <ActionButton action="close" text="Close" onClick={onClose} />
          </div>
        }
      >
        {!sr ? <Skeleton active paragraph={{ rows: 8 }} /> : (
          <Spin spinning={loading} tip="Refreshing…">
          <DraftWatermark status={sr.status}>
            <div style={{ marginBottom: 20 }}>
              <StatusSteps
                statusFlow={statusFlow}
                currentStatus={TERMINALS.includes(sr.status) ? sr.status : sr.status}
                statusConfig={{ ...SR_STATUS_CONFIG, OUTCOME: {} }}
                getLabel={(s) => (s === 'OUTCOME' ? 'Outcome' : getSrStatusLabel(s))}
                getDescription={getStepDescription}
                size="small"
              />
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <SectionHeader srNo={sr.srNo} header={sr} round={sr.round} priorFeedbackRef={sr.priorFeedbackRef} />
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
                <ViewMaterials sr={sr} onRaisePo={(line) => setPoDrawer({ open: true, focusLine: line })} />
                <div id="sr-dispatch-panel">
                  <DispatchPanel sr={sr} overseas={overseas} onChanged={refresh} />
                </div>
                <div id="sr-comments-panel">
                  <BuyerCommentsPanel sr={sr} onChanged={refresh} />
                </div>
                <ActivityLogPanel activity={sr.activity} />
              </Col>
              <Col xs={24} lg={8}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <DeadlinesPanel sr={sr} />
                  <AvailableActionsPanel sr={sr} canUpdate={canUpdate} canDelete={canDelete} handlers={handlers} />
                  <InvoicePanel sr={sr} overseas={overseas} />
                  <RevisionHistoryPanel sr={sr} chain={chain} onOpen={(id) => setCurrentId(id)} />
                </div>
              </Col>
            </Row>
          </DraftWatermark>
          </Spin>
        )}
      </ViewDialog>
      <RaisePoDrawer
        open={poDrawer.open}
        sr={sr}
        focusLine={poDrawer.focusLine}
        onClose={() => setPoDrawer({ open: false, focusLine: null })}
        onCreated={refresh}
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
            });
            message.success('Instructions updated — change logged in the activity trail');
            setInstrModal((s) => ({ ...s, open: false, saving: false }));
            refresh();
          } catch (e) {
            message.error(e.message || 'Failed to update');
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
