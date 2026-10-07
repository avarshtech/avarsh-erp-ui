import { useMemo, useState } from 'react';
import { Button, Result, Skeleton } from 'antd';
import { FileSearchOutlined, HistoryOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import DetailCard from '../../../components/DetailCard';
import DocumentHistoryDrawer from '../../../components/DocumentHistoryDrawer';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useActionRunner from '../../../hooks/useActionRunner';
import useEditParam from '../../../hooks/useEditParam';
import { useBranch } from '../../../context/BranchContext';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { validateGpo, requirementCards, gpoLineLabel } from '../../../utils/garmentProcessPoCalc';
import { refetchGpoLines } from '../../../utils/jobWorkRefetch';
import { getGpoAudit } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import JobWorkStatusBanner from '../jobWork/JobWorkStatusBanner';
import JobWorkPoHero from '../jobWork/JobWorkPoHero';
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
import useGpoSignOff from './useGpoSignOff';
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
 * Garment Process PO — one scrolling screen in the Supplier PO view's look (a hero, titled sections) and a sticky action
 * bar (PRD §19). Everything is the API: the PO, its ledger and approval (the approval engine, with the
 * vendor sign-off), the requirements, vendors, processes, payment terms, branches and units.
 */
const GarmentProcessPoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const po = useGarmentProcessPo(id);
  const { clearDirty } = useUnsavedChanges(po.dirty);
  const { activeBranch, defaultBranch } = useBranch();
  const [editing, setEditing] = useEditParam();
  // Drafts pick from the masters; approvers see the live vendor (eligibility re-checked at approval, §13).
  const masters = useJobWorkMasters('Garment', { enabled: ['DRAFT', 'SUBMITTED'].includes(po.doc?.status) });
  const ctx = useGpoContext(po.doc, masters.jobWorkers);
  const checks = useMemo(() => (po.doc ? validateGpo(po.doc, ctx) : null), [po.doc, ctx]);
  const view = useGpoView(po, ctx, checks, editing);
  const cards = useMemo(() => (po.doc ? requirementCards(po.doc, ctx) : []), [po.doc, ctx]);
  const runner = useActionRunner(id ?? 'new');
  const draft = useGpoDraftActions({ ...po, clearDirty, runner, unit: activeBranch || defaultBranch, liveVendor: ctx?.liveVendor });
  const flow = useGpoFlowActions({ ...po, clearDirty, runner });
  const lines = useGpoLineHandlers({ ...po, masters });
  const h = useGpoHandlers({ ...po, masters, value: view?.value });
  const signOff = useGpoSignOff(po.doc || {}, ctx);
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
    ...flow, edit: () => setEditing(true), save: draft.save, remove: draft.remove, amend: () => setAmendOpen(true),
    submit: () => (checks?.blocking.length ? runner.setErrors(checks.blocking) : draft.submit()),
  };

  return (
    <div className="animate-fade-in-up">
      <JobWorkPoHero
        doc={doc} typeLabel="Garment Process PO" total={view.value.total} totalLabel="Grand total" dueDate={doc.expectedReturnDate}
        subtitle={<GpoTraceLine doc={doc} />} onBack={() => navigate(LIST)}
        actions={doc.id && (
          <>
            {doc.status !== 'DRAFT' && <Button icon={<PrinterOutlined />} loading={h.printing} onClick={h.print}>Print</Button>}
            <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>
          </>
        )}
      />
      <JobWorkStatusBanner doc={doc} flags={view.flags} refetch={refetch} />
      <GpoHeaderSection doc={doc} editable={view.draft} masters={masters} eligibility={ctx?.eligibility} onPatch={patch} onVendor={h.pickVendor} />
      {view.draft && (
        <DetailCard id="gpo-selection" bare icon={<FileSearchOutlined />} title="Select Garment Process Requirement" style={{ marginBottom: 16 }}
          extra={<span style={{ fontSize: 12, opacity: 0.65 }}>Only submitted requirements with balance are selectable</span>}>
          <GpoRequirementPicker lines={doc.lines} refresh={`${doc.version}|${doc.lines.length}`} adding={lines.adding} onAdd={lines.addCells} />
        </DetailCard>
      )}
      <GpoRequirementCards cards={cards} orders={ctx?.orders} onOpenGpr={(gprId) => navigate(`/bom/garment-process/${gprId}`)} />
      <GpoLinesSection doc={doc} ctx={ctx} editable={view.draft} canRequest={view.draft} selectedKeys={po.selectedKeys} h={lines.grid} />
      <GpoBottomRow doc={doc} value={view.value} units={units} editable={{ delivery: view.draft, commercial: view.draft }} onPatch={patch} />
      {(doc.status !== 'DRAFT' || doc.overrides.length > 0 || doc.rejectNote || doc.sendBackNote) && (
        <JobWorkApprovalPanel
          entityType="GARMENT_PROCESS_PO" doc={doc} docLabel="Garment Process PO" onDecided={po.reload}
          buildActionData={signOff.buildActionData} extraContent={signOff.extraContent}
          overrides={doc.overrides} busy={runner.busy === 'excessApprove'} onAuthorise={draft.approveExcess}
          lineLabel={(k) => { const l = doc.lines.find((x) => x.key === k); return l ? gpoLineLabel(l) : k; }}
          canAuthorise={(o) => o.status === 'REQUESTED' && doc.status === 'DRAFT' && view.can.override && (String(o.requestedById) !== String(view.userId) || view.superuser)}
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
