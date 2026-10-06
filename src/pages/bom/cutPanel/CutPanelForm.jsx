import { useMemo, useState } from 'react';
import { App, Button, Skeleton, Space } from 'antd';
import { HistoryOutlined, PartitionOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useRequirementMasters from '../../../hooks/useRequirementMasters';
import { hasPermission, canCloseRequirement, canSubmitRequirement } from '../../../utils/permissions';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementEditable } from '../../../utils/requirementStatus';
import { CPR_MODULE_ID, CPR_PROCESS_CATEGORY } from '../../../utils/cutPanelConstants';
import { cprTotals } from '../../../utils/cutPanelCalc';
import { exportCprCsv, printCprStatement } from '../../../utils/cutPanelStatementPrint';
import { getCprAudit, getCprAllocation } from '../../../services/bom/cutPanel/cutPanelService';
import DocumentHistoryDrawer from '../../../components/DocumentHistoryDrawer';
import RequirementAllocationDrawer from '../shared/RequirementAllocationDrawer';
import RequirementNotFound from '../shared/RequirementNotFound';
import RequirementStatusBanner from '../shared/RequirementStatusBanner';
import RequirementTransitionDialog from '../shared/RequirementTransitionDialog';
import useRequirementEditMode from '../shared/useRequirementEditMode';
import useCutPanelRequirement from './useCutPanelRequirement';
import useCprActions from './useCprActions';
import useCprLineHandlers from './useCprLineHandlers';
import CprHeaderSection from './CprHeaderSection';
import CprSelectionStrip from './CprSelectionStrip';
import CprRequirementGrid from './CprRequirementGrid';
import CprSummarySection from './CprSummarySection';
import CprActionBar from './CprActionBar';

const LIST_PATH = '/bom/cut-panel/list';

/**
 * Cut Panel Requirement — the single scrolling screen (PRD §8): header, selection
 * strip, requirement grid, summary and a sticky action bar. No wizard, no approval. A
 * submitted CPR is edited in place (`?edit=1`) until a PO against it is placed.
 */
const CutPanelForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { doc, order, dirty, dispatch, loading, orders, siblings, selectOrder, reload } = useCutPanelRequirement(id);
  const { clearDirty } = useUnsavedChanges(dirty);
  const isSaved = Boolean(doc?.id);
  const can = useMemo(() => ({
    edit: hasPermission(CPR_MODULE_ID, isSaved ? 'update' : 'add'),
    submit: canSubmitRequirement(CPR_MODULE_ID),
    delete: hasPermission(CPR_MODULE_ID, 'delete'),
    close: canCloseRequirement(CPR_MODULE_ID),
  }), [isSaved]);
  const mode = useRequirementEditMode({ id, doc, loading, dirty, canEdit: can.edit, clearDirty, reload, docNo: doc?.cprNo });
  const actions = useCprActions({ doc, dirty, order, dispatch, clearDirty, reload, onRevised: mode.stopEdit });
  const { gridHandlers, addLines } = useCprLineHandlers({ doc, order, dispatch });
  const [closeOpen, setCloseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);

  const editable = Boolean(doc) && can.edit && (isRequirementEditable(doc.status) || mode.editing);
  const masters = useRequirementMasters(CPR_PROCESS_CATEGORY, { enabled: editable && Boolean(order), withParts: true });
  const lines = doc?.lines;
  const fabrics = useMemo(() => order?.fabrics || [], [order]);
  const totals = useMemo(() => cprTotals(lines || [], order?.sizes || []), [lines, order]);

  const { save, submit, saveChanges, remove } = actions;
  const { startEdit, cancelEdit } = mode;
  const barActions = useMemo(() => ({
    cancel: () => navigate(LIST_PATH), save, submit, remove, saveChanges,
    edit: startEdit, cancelEdit, close: () => setCloseOpen(true),
  }), [navigate, save, submit, remove, saveChanges, startEdit, cancelEdit]);

  const print = () => { if (!printCprStatement(doc, order)) message.warning('Allow pop-ups to print the statement.'); };

  if (loading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (!doc) return <RequirementNotFound listPath={LIST_PATH} />;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={doc.cprNo ? `Cut Panel Requirement ${doc.cprNo}` : 'New Cut Panel Requirement'}
        subtitle="Which panel, in which fabric, colour and size, needs which process — in sequence"
        backPath={LIST_PATH}
        status={<StatusTag status={doc.status} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />}
      >
        <Space wrap>
          {doc.id && !editable && <Button icon={<PartitionOutlined />} onClick={() => setAllocationOpen(true)}>PO allocation</Button>}
          {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
        </Space>
      </PageHeader>

      <RequirementStatusBanner doc={doc} />

      <CprHeaderSection
        doc={doc} order={order} orders={orders} siblings={siblings} editable={editable}
        onSelectOrder={selectOrder}
        onRecalculate={gridHandlers.onRecalcAll}
      />
      {editable && order && (
        <CprSelectionStrip
          key={doc.orderId}
          order={order} fabrics={fabrics} processes={masters.processes} parts={masters.parts} masters={masters}
          defaultAllowance={doc.orderAllowancePct} onAdd={addLines}
        />
      )}
      {order && <CprRequirementGrid doc={doc} order={order} editable={editable} handlers={gridHandlers} />}
      {order && (
        <CprSummarySection doc={doc} order={order} showChecks={editable}
          onPrint={print} onExport={() => exportCprCsv(doc, order)} />
      )}

      <CprActionBar
        doc={doc} totals={totals} orderColourCount={order?.colors.length || 0} can={can} editing={mode.editing} dirty={dirty}
        busy={actions.busy} errors={actions.errors} on={barActions}
      />
      <RequirementTransitionDialog
        open={closeOpen} onDone={() => setCloseOpen(false)} actions={actions}
        docLabel="Cut Panel Requirement" docNumber={doc.cprNo}
      />
      <DocumentHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.cprNo} loadAudit={getCprAudit} />
      <RequirementAllocationDrawer open={allocationOpen} onClose={() => setAllocationOpen(false)} source="CPR" docId={doc.id} docNo={doc.cprNo} load={getCprAllocation} />
    </div>
  );
};

export default CutPanelForm;
