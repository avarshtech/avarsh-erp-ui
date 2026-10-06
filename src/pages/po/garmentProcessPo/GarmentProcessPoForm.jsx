import { useMemo, useState } from 'react';
import { Button, Card, Result, Skeleton, Space } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import DocumentHistoryDrawer from '../../../components/DocumentHistoryDrawer';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useActionRunner from '../../../hooks/useActionRunner';
import { useBranch } from '../../../context/BranchContext';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { validateGpo, requirementCards, gpoLineLabel, GPO_LEVELS } from '../../../utils/garmentProcessPoCalc';
import { refetchGpoLines } from '../../../utils/jobWorkRefetch';
import { getGpoAudit } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import JobWorkTypeSwitch from '../jobWork/JobWorkTypeSwitch';
import JobWorkStatusBanner from '../jobWork/JobWorkStatusBanner';
import JobWorkApprovalPanel from '../jobWork/JobWorkApprovalPanel';
import JobWorkReasonDialog from '../jobWork/JobWorkReasonDialog';
import OverrideRequestDialog from '../jobWork/OverrideRequestDialog';
import useJobWorkMasters from '../jobWork/useJobWorkMasters';
import useJobWorkRefetch from '../jobWork/useJobWorkRefetch';
import useJobWorkUnits from '../jobWork/useJobWorkUnits';
import useGarmentProcessPo from './useGarmentProcessPo';
import useGpoContext from './useGpoContext';
import useGpoView from './useGpoView';
import useGpoDraftActions from './useGpoDraftActions';
import useGpoFlowActions from './useGpoFlowActions';
import useGpoLineHandlers from './useGpoLineHandlers';
import useGpoHandlers from './useGpoHandlers';
import { GPO_DIALOGS } from './gpoDialogs';
import GpoTraceLine from './GpoTraceLine';
import GpoHeaderSection from './GpoHeaderSection';
import GpoRequirementPicker from './GpoRequirementPicker';
import GpoRequirementCards from './GpoRequirementCards';
import GpoLinesSection from './GpoLinesSection';
import GpoBottomRow from './GpoBottomRow';
import GpoActionBar from './GpoActionBar';
import GpoAmendDialog from './GpoAmendDialog';

const LIST = `${JOB_WORK_PO_PATH.GPO}/list`;

/**
 * Garment Process PO — one scrolling screen, wireframe sections ①–⑦ and a sticky action
 * bar (PRD §19). UI mock phase: the PO, its ledger and the requirements are the
 * localStorage mock; vendors, processes, payment terms, branches and units are the real API.
 */
const GarmentProcessPoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const po = useGarmentProcessPo(id);
  const { clearDirty } = useUnsavedChanges(po.dirty);
  const { activeBranch, defaultBranch } = useBranch();
  // Drafts pick from the masters; approvers see the live vendor (eligibility re-checked at approval, §13).
  const masters = useJobWorkMasters('Garment', { enabled: ['DRAFT', 'SUBMITTED'].includes(po.doc?.status) });
  const ctx = useGpoContext(po.doc, masters.jobWorkers);
  const checks = useMemo(() => (po.doc ? validateGpo(po.doc, ctx) : null), [po.doc, ctx]);
  const view = useGpoView(po, ctx, checks);
  const cards = useMemo(() => (po.doc ? requirementCards(po.doc, ctx) : []), [po.doc, ctx]);
  const runner = useActionRunner(id ?? 'new');
  const draft = useGpoDraftActions({ ...po, clearDirty, runner, unit: activeBranch || defaultBranch, liveVendor: ctx?.liveVendor });
  const flow = useGpoFlowActions({ ...po, clearDirty, runner });
  const lines = useGpoLineHandlers({ ...po, masters });
  const h = useGpoHandlers({ ...po, masters, ctx, value: view?.value, flow });
  const refetch = useJobWorkRefetch({ lines: po.doc?.lines, ctx, dispatch: po.dispatch, rebuild: refetchGpoLines, enabled: Boolean(view?.draft) });
  const [dialog, setDialog] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const units = useJobWorkUnits(po.doc?.branchId ?? (activeBranch || defaultBranch)?.id, { enabled: Boolean(view?.draft || amendOpen) });

  if (po.loading) return <Skeleton active paragraph={{ rows: 14 }} />;
  if (!po.doc) return <Result status="404" title="Garment Process PO not found" extra={<Button onClick={() => navigate(LIST)}>Back to list</Button>} />;
  const { doc, dispatch } = po;
  const patch = (p) => dispatch({ type: 'PATCH', patch: p });
  const on = {
    ...flow, back: () => navigate(LIST), print: h.print, save: draft.save, approve: h.approve, amend: () => setAmendOpen(true),
    submit: () => (checks?.blocking.length ? runner.setErrors(checks.blocking) : draft.submit()),
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={doc.poNo ? `Garment Process PO ${doc.poNo}` : 'New Garment Process PO'} backPath={LIST} subtitle={<GpoTraceLine doc={doc} />}
        status={<StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />}
      >
        <Space wrap>
          <JobWorkTypeSwitch type="GPO" locked={Boolean(doc.id || doc.lines.length)} />
          {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
        </Space>
      </PageHeader>
      <JobWorkStatusBanner doc={doc} flags={view.flags} refetch={refetch} />
      <GpoHeaderSection doc={doc} editable={view.draft} masters={masters} eligibility={ctx?.eligibility} onPatch={patch} onVendor={h.pickVendor} />
      {view.draft && (
        <Card id="gpo-selection" size="small" title="② Select Garment Process Requirement" style={{ marginBottom: 16 }}
          extra={<span style={{ fontSize: 12, opacity: 0.65 }}>Only submitted requirements with balance are selectable</span>}>
          <GpoRequirementPicker lines={doc.lines} refresh={`${doc.version}|${doc.lines.length}`} adding={lines.adding} onAdd={lines.addCells} />
        </Card>
      )}
      <GpoRequirementCards cards={cards} orders={ctx?.orders} onOpenGpr={(gprId) => navigate(`/bom/garment-process/${gprId}`)} />
      <GpoLinesSection doc={doc} ctx={ctx} editable={view.draft} canRequest={view.draft} selectedKeys={po.selectedKeys} h={lines.grid} />
      <GpoBottomRow doc={doc} value={view.value} units={units} editable={{ delivery: view.draft, commercial: view.draft }} onPatch={patch} />
      {(doc.status !== 'DRAFT' || doc.overrides.length > 0) && (
        <JobWorkApprovalPanel
          levels={doc.levelNames || GPO_LEVELS} approvals={doc.approvals} overrides={doc.overrides} busy={runner.busy === 'excessApprove'} onAuthorise={draft.approveExcess}
          lineLabel={(k) => { const l = doc.lines.find((x) => x.key === k); return l ? gpoLineLabel(l) : k; }}
          canAuthorise={(o) => o.status === 'REQUESTED' && doc.status === 'DRAFT' && view.can.override && (o.requestedByUser !== view.username || view.superuser)}
        />
      )}
      <GpoActionBar doc={doc} value={view.value} checks={checks} buttons={view.buttons} busy={runner.busy} errors={runner.errors} on={on} openDialog={setDialog} />
      <JobWorkReasonDialog dialog={dialog && { open: true, ...GPO_DIALOGS[dialog] }} onSubmit={(r) => on[dialog](r)} onClose={() => setDialog(null)} />
      <OverrideRequestDialog request={lines.excessRequest} onSubmit={draft.requestExcess} onClose={lines.closeExcess} />
      <GpoAmendDialog open={amendOpen} doc={doc} units={units} onSubmit={flow.amend} onClose={() => setAmendOpen(false)} />
      <DocumentHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.poNo} loadAudit={getGpoAudit} />
    </div>
  );
};

export default GarmentProcessPoForm;
