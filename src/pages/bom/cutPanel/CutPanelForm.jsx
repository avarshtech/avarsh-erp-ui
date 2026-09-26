import { useCallback, useMemo, useState } from 'react';
import { Alert, App, Button, Skeleton } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import StatusSteps from '../../../components/StatusSteps';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import useRequirementMasters from '../../../hooks/useRequirementMasters';
import { hasPermission, canReopenRequirement, canCloseRequirement } from '../../../utils/permissions';
import { REQUIREMENT_STATUS_CONFIG, REQUIREMENT_STATUS_FLOW } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementEditable } from '../../../utils/requirementStatus';
import { CPR_MODULE_ID, CPR_PROCESS_CATEGORY } from '../../../utils/cutPanelConstants';
import { cprTotals, expandSelection } from '../../../utils/cutPanelCalc';
import { exportCprCsv, printCprStatement } from '../../../utils/cutPanelStatementPrint';
import { formatDate } from '../../../utils/formatters';
import { getCprAudit } from '../../../services/bom/cutPanel/cutPanelService';
import { CLOSE_ACTION, REOPEN_ACTION } from '../shared/requirementDialogs';
import RequirementHistoryDrawer from '../shared/RequirementHistoryDrawer';
import useCutPanelRequirement from './useCutPanelRequirement';
import useCprActions from './useCprActions';
import CprHeaderSection from './CprHeaderSection';
import CprSelectionStrip from './CprSelectionStrip';
import CprRequirementGrid from './CprRequirementGrid';
import CprSummarySection from './CprSummarySection';
import CprActionBar from './CprActionBar';

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
  const actions = useCprActions({ doc, order, dispatch, clearDirty });
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const can = {
    edit: hasPermission(CPR_MODULE_ID, doc?.id ? 'update' : 'add'),
    delete: hasPermission(CPR_MODULE_ID, 'delete'),
    reopen: canReopenRequirement(CPR_MODULE_ID),
    close: canCloseRequirement(CPR_MODULE_ID),
  };
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

  const addLines = useCallback((selection) => {
    const { lines, skipped } = expandSelection({ ...selection, order, existingLines: doc.lines });
    if (lines.length) dispatch({ type: 'LINES_ADDED', lines });
    return { added: lines.length, skipped };
  }, [order, doc, dispatch]);

  const confirmDialog = async (text) => {
    const ok = dialog === 'close' ? await actions.close(text.trim()) : await actions.reopen();
    if (ok) { setDialog(null); setReason(''); }
  };

  const print = () => { if (!printCprStatement(doc, order)) message.warning('Allow pop-ups to print the statement.'); };

  if (loading || !doc) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={doc.cprNo ? `Cut Panel Requirement ${doc.cprNo}` : 'New Cut Panel Requirement'}
        subtitle="Which panel, in which fabric, colour and size, needs which process — in sequence"
        backPath="/bom/cut-panel/list"
        status={<StatusTag status={doc.status} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />}
      >
        {doc.id && <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>History</Button>}
      </PageHeader>

      {REQUIREMENT_STATUS_FLOW.includes(doc.status) && (
        <StatusSteps statusFlow={REQUIREMENT_STATUS_FLOW} currentStatus={doc.status} statusConfig={REQUIREMENT_STATUS_CONFIG}
          getLabel={getRequirementStatusLabel} size="small" style={{ marginBottom: 16 }} />
      )}
      {doc.closeReason && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          title={`Closed by ${doc.closedBy} on ${formatDate(doc.closedOn, 'DD-MM-YYYY')}`} description={doc.closeReason} />
      )}

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
        on={{
          cancel: () => navigate('/bom/cut-panel/list'),
          save: actions.save, submit: actions.submit, remove: actions.remove,
          reopen: () => setDialog('reopen'), close: () => setDialog('close'),
        }}
      />
      <ApprovalReasonDialog
        open={Boolean(dialog)} onCancel={() => { setDialog(null); setReason(''); }} onConfirm={confirmDialog}
        loading={actions.busy === 'close' || actions.busy === 'reopen'}
        action={dialog === 'close' ? CLOSE_ACTION : REOPEN_ACTION}
        docLabel="Cut Panel Requirement" docNumber={doc.cprNo} reason={reason} onReasonChange={setReason}
      />
      <RequirementHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} docId={doc.id} docNo={doc.cprNo} loadAudit={getCprAudit} />
    </div>
  );
};

export default CutPanelForm;
