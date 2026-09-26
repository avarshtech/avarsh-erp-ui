import { useCallback, useMemo, useState } from 'react';
import { App, Button, Skeleton } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useRequirementMasters from '../../../hooks/useRequirementMasters';
import {
  hasPermission, canReopenRequirement, canCloseRequirement, canSubmitRequirement,
} from '../../../utils/permissions';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementEditable } from '../../../utils/requirementStatus';
import { CPR_MODULE_ID, CPR_PROCESS_CATEGORY } from '../../../utils/cutPanelConstants';
import { cprTotals, expandSelection } from '../../../utils/cutPanelCalc';
import { exportCprCsv, printCprStatement } from '../../../utils/cutPanelStatementPrint';
import { getCprAudit } from '../../../services/bom/cutPanel/cutPanelService';
import RequirementHistoryDrawer from '../shared/RequirementHistoryDrawer';
import RequirementNotFound from '../shared/RequirementNotFound';
import RequirementStatusBanner from '../shared/RequirementStatusBanner';
import RequirementTransitionDialog from '../shared/RequirementTransitionDialog';
import useCutPanelRequirement from './useCutPanelRequirement';
import useCprActions from './useCprActions';
import CprHeaderSection from './CprHeaderSection';
import CprSelectionStrip from './CprSelectionStrip';
import CprRequirementGrid from './CprRequirementGrid';
import CprSummarySection from './CprSummarySection';
import CprActionBar from './CprActionBar';

const LIST_PATH = '/bom/cut-panel/list';

/**
 * Cut Panel Requirement — the single scrolling screen (PRD §8): header, selection
 * strip, requirement grid, summary and a sticky action bar. No wizard, no approval.
 */
const CutPanelForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { doc, order, dirty, dispatch, loading, orders, siblings, selectOrder } = useCutPanelRequirement(id);
  const { clearDirty } = useUnsavedChanges(dirty);
  const actions = useCprActions({ doc, dirty, order, dispatch, clearDirty });
  const [dialog, setDialog] = useState({ kind: 'close', open: false });
  const [historyOpen, setHistoryOpen] = useState(false);

  const isSaved = Boolean(doc?.id);
  const can = useMemo(() => ({
    edit: hasPermission(CPR_MODULE_ID, isSaved ? 'update' : 'add'),
    submit: canSubmitRequirement(CPR_MODULE_ID),
    delete: hasPermission(CPR_MODULE_ID, 'delete'),
    reopen: canReopenRequirement(CPR_MODULE_ID),
    close: canCloseRequirement(CPR_MODULE_ID),
  }), [isSaved]);
  const editable = Boolean(doc) && isRequirementEditable(doc.status) && can.edit;
  const masters = useRequirementMasters(CPR_PROCESS_CATEGORY, { enabled: editable && Boolean(order), withParts: true });
  const bomVersion = doc?.bomVersion;
  const lines = doc?.lines;
  const fabrics = useMemo(() => order?.approvedBoms.find((b) => b.version === bomVersion)?.fabrics || [], [order, bomVersion]);
  const totals = useMemo(() => cprTotals(lines || [], order?.sizes || []), [lines, order]);

  const gridHandlers = useMemo(() => ({
    onSeq: (key, v) => dispatch({ type: 'LINE_PATCHED', key, patch: { sequenceNo: v } }),
    onAllow: (key, pct) => dispatch({ type: 'LINE_ALLOWANCE', key, pct }),
    onQty: (key, size, qty) => dispatch({ type: 'LINE_QTY', key, size, qty }),
    onReason: (key, v) => dispatch({ type: 'LINE_PATCHED', key, patch: { varianceReason: v } }),
    onRemove: (key) => dispatch({ type: 'LINES_REMOVED', keys: [key] }),
    onRemoveMany: (keys) => dispatch({ type: 'LINES_REMOVED', keys }),
    onRecalcAll: () => dispatch({ type: 'RECALC_ALL' }),
    onApplyAllowance: (pct, includeOverridden) => dispatch({ type: 'APPLY_ALLOWANCE_ALL', pct, includeOverridden }),
  }), [dispatch]);

  const lastLineNo = doc?.lastLineNo;
  const addLines = useCallback((selection) => {
    const { lines: added, skipped } = expandSelection({ ...selection, order, existingLines: lines, lastLineNo });
    if (added.length) dispatch({ type: 'LINES_ADDED', lines: added });
    return { added: added.length, skipped };
  }, [order, lines, lastLineNo, dispatch]);

  const { save, submit, remove } = actions;
  const barActions = useMemo(() => ({
    cancel: () => navigate(LIST_PATH), save, submit, remove,
    reopen: () => setDialog({ kind: 'reopen', open: true }), close: () => setDialog({ kind: 'close', open: true }),
  }), [navigate, save, submit, remove]);

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
        {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
      </PageHeader>

      <RequirementStatusBanner doc={doc} />

      <CprHeaderSection
        doc={doc} order={order} orders={orders} siblings={siblings} editable={editable}
        onSelectOrder={selectOrder}
        onSelectBom={(bomVersion) => dispatch({ type: 'BOM_SELECTED', bomVersion })}
        onRecalculate={gridHandlers.onRecalcAll}
      />
      {editable && order && (
        <CprSelectionStrip
          key={`${doc.orderId}-${doc.bomVersion}`}
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
        doc={doc} totals={totals} orderColourCount={order?.colors.length || 0} can={can} busy={actions.busy} errors={actions.errors}
        on={barActions}
      />
      <RequirementTransitionDialog
        dialog={dialog} onDone={() => setDialog((d) => ({ ...d, open: false }))} actions={actions}
        docLabel="Cut Panel Requirement" docNumber={doc.cprNo}
      />
      <RequirementHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.cprNo} loadAudit={getCprAudit} />
    </div>
  );
};

export default CutPanelForm;
