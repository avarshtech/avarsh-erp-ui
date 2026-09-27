import { useMemo, useState } from 'react';
import { Button, Result, Skeleton, Space } from 'antd';
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
import { validateCpp } from '../../../utils/cutPanelPoCalc';
import { revisionChanges, ISSUED_FIELDS, REVISION_FIELDS } from '../../../utils/cutPanelPoRevision';
import { getCppAudit } from '../../../services/po/cutPanelPo/cutPanelPoService';
import JobWorkTypeSwitch from '../jobWork/JobWorkTypeSwitch';
import JobWorkStatusBanner from '../jobWork/JobWorkStatusBanner';
import JobWorkApprovalPanel from '../jobWork/JobWorkApprovalPanel';
import JobWorkReasonDialog from '../jobWork/JobWorkReasonDialog';
import OverrideRequestDialog from '../jobWork/OverrideRequestDialog';
import useJobWorkMasters from '../jobWork/useJobWorkMasters';
import useCutPanelPo from './useCutPanelPo';
import useCppContext from './useCppContext';
import useCppView from './useCppView';
import useCppHandlers from './useCppHandlers';
import useCppRequirementLookup from './useCppRequirementLookup';
import useCppDraftActions from './useCppDraftActions';
import useCppFlowActions from './useCppFlowActions';
import { CPP_DIALOGS } from './cppDialogs';
import CppHeaderSection from './CppHeaderSection';
import CppRequirementSection from './CppRequirementSection';
import CppVendorSection from './CppVendorSection';
import CppGridSection from './CppGridSection';
import CppDeliverySection from './CppDeliverySection';
import CppAdvisories from './CppAdvisories';
import CppRevisionHistory from './CppRevisionHistory';
import CppActionBar from './CppActionBar';

const LIST = `${JOB_WORK_PO_PATH.CPP}/list`;
const pick = (src, fields) => Object.fromEntries(fields.map((f) => [f, src[f]]));
const AMENDABLE = new Set(REVISION_FIELDS);

/**
 * Cut Panel PO — one scrolling screen, six numbered sections and a sticky action bar
 * (PRD §18.1); no wizard. UI mock phase: the PO, its ledger and the requirements are the
 * localStorage mock; suppliers, processes, payment terms and branches are the real API.
 */
const CutPanelPoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const po = useCutPanelPo(id);
  const { clearDirty } = useUnsavedChanges(po.dirty);
  const { allowedBranches, activeBranch, defaultBranch } = useBranch();
  const baseView = useCppView(po, null);
  const working = baseView?.working ?? null;
  const masters = useJobWorkMasters('Cut Panel', { enabled: Boolean(baseView?.edit.draft || baseView?.edit.delivery) });
  const ctx = useCppContext(working, masters.jobWorkers);
  const view = useCppView(po, ctx);
  const checks = useMemo(() => (ctx && working ? validateCpp(working, ctx) : null), [working, ctx]);
  const lookup = useCppRequirementLookup({ enabled: Boolean(view?.edit.draft), label: po.doc?.process?.label, refresh: po.doc?.lines.length });
  const runner = useActionRunner();
  const draft = useCppDraftActions({ ...po, clearDirty, runner, unit: activeBranch || defaultBranch });
  const flow = useCppFlowActions({ ...po, clearDirty, runner });
  const h = useCppHandlers({ ...po, view, masters });
  const [dialog, setDialog] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (po.loading) return <Skeleton active paragraph={{ rows: 14 }} />;
  if (!po.doc) return <Result status="404" title="Cut Panel PO not found" extra={<Button onClick={() => navigate(LIST)}>Back to list</Button>} />;
  const { doc, dispatch } = po;
  // While an amendment is open, its fields go to the amendment, never to the live PO.
  const patch = (p) => dispatch({ type: po.rev && Object.keys(p).every((k) => AMENDABLE.has(k)) ? 'COMMERCIAL' : 'PATCH', patch: p });
  const on = {
    ...flow, back: () => navigate(LIST), print: h.print, save: draft.save, remove: draft.remove,
    submit: () => (checks?.blocking.length ? runner.setErrors(checks.blocking) : draft.submit()),
    saveDetails: () => flow.saveDetails(pick(doc, [...ISSUED_FIELDS, 'instructions', 'remarks', 'references'])),
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={doc.poNo ? `Cut Panel PO ${doc.poNo}` : 'New Cut Panel PO'} backPath={LIST}
        subtitle="Job work on cut panels against a submitted Cut Panel Requirement — who does it, how much, at what rate"
        status={<StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />}
      >
        <Space wrap>
          <JobWorkTypeSwitch type="CPP" locked={Boolean(doc.id || doc.lines.length)} />
          {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
        </Space>
      </PageHeader>
      <JobWorkStatusBanner doc={doc} flags={view.flags} />
      <CppHeaderSection doc={working} editable={view.edit.draft} branches={allowedBranches} unit={activeBranch || defaultBranch} onPatch={patch} />
      <CppRequirementSection
        doc={working} editable={view.edit.draft} lookup={lookup} selection={po.selection} adding={h.adding}
        onProcess={h.chooseProcess} onSelection={(p) => dispatch({ type: 'SELECTION', patch: p })} onAdd={h.addToGrid}
        masterNote={view.edit.draft && masters.denied.includes('Processes') ? 'SAC 998821, GST 5% and Piece are assumed: the Processes master is not readable with your permissions.' : null}
      />
      <CppVendorSection doc={working} editable={{ vendor: view.edit.delivery, terms: view.edit.terms }} masters={masters} eligibility={ctx?.eligibility} onPatch={patch} />
      <CppGridSection doc={working} editable={view.edit.lines} ctx={ctx} rates={{ byKey: ctx?.lastRates, recent: ctx?.recentRates }} selectedKeys={po.selectedKeys} h={h.grid} />
      <CppDeliverySection doc={working} ctx={ctx} value={view.value} branches={allowedBranches} onPatch={patch}
        can={{ delivery: view.edit.delivery, terms: view.edit.terms, notes: view.edit.notes, commercial: view.edit.commercial }}
        onCommercial={(p) => dispatch({ type: 'COMMERCIAL', patch: p })} />
      <CppAdvisories doc={working} advisories={checks?.advisories.filter((a) => a.code !== 'RATE_VARIANCE' || !a.resolved)} editable={view.edit.draft || view.edit.commercial} onPatch={patch} />
      {(doc.status !== 'DRAFT' || doc.overrides.length > 0) && (
        <JobWorkApprovalPanel
          levels={doc.pendingRevision?.levelNames || doc.levelNames} approvals={doc.pendingRevision?.approvals || doc.approvals}
          overrides={doc.overrides} busy={runner.busy === 'authorise'} onAuthorise={draft.authorise}
          lineLabel={(k) => { const l = doc.lines.find((x) => x.key === k); return l ? `${l.cprNo} ${l.colorName} ${l.size}` : k; }}
          canAuthorise={(o) => o.status === 'REQUESTED' && doc.status === 'DRAFT' && view.can.override && (o.requestedByUser !== view.username || view.superuser)}
        />
      )}
      <CppRevisionHistory revisions={doc.revisions} pending={doc.pendingRevision && { ...doc.pendingRevision, changes: revisionChanges(doc, po.rev || doc.pendingRevision) }} />
      <CppActionBar doc={working} ctx={ctx} value={view.value} buttons={view.buttons} busy={runner.busy} errors={runner.errors} on={on} openDialog={(k) => setDialog(k)} />
      <JobWorkReasonDialog dialog={dialog && { open: true, ...CPP_DIALOGS[dialog] }} onSubmit={(r) => on[dialog](r)} onClose={() => setDialog(null)} />
      <OverrideRequestDialog request={h.overrideRequest} onSubmit={draft.requestOverride} onClose={h.closeOverride} />
      <DocumentHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.poNo} loadAudit={getCppAudit} />
    </div>
  );
};

export default CutPanelPoForm;
