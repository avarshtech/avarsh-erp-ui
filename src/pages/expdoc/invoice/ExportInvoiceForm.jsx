import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Card, Result, Skeleton, Space, Steps, Tag, Tooltip } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { hasPermission } from '../../../utils/permissions';
import {
  EXPDOC_MODULE, INVOICE_STATUS, INVOICE_STATUS_LABELS, LINE_GRAIN_LABELS,
} from '../../../utils/expDocConstants';
import { EXPORT_INVOICE_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  getInvoice, updateInvoice, regenerateInvoiceLines, acknowledgeInvoiceWarning,
  changeInvoiceStatus, reviseInvoice, getShipment, listIncoterms, markInvoiceExported,
} from '../../../services/expdoc/expDocService';
import PlValidationPanel from '../packing-list/PlValidationPanel';
import AckReasonModal from '../shared/AckReasonModal';
import useExporterBlock from '../shared/useExporterBlock';
import {
  InvStepSource, InvStepHeader, InvStepLines, InvStepFinancials, InvStepDeclarations,
} from './InvSteps';
import InvPreviewDrawer from './InvPreviewDrawer';

const LIST_PATH = '/export-docs/invoices/list';
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

// AntD 6 renames the Steps item's `description` to `content`.
const STEPS = [
  { key: 'source', title: 'Source', content: 'Packing lists' },
  { key: 'header', title: 'Header', content: 'Parties and terms' },
  { key: 'lines', title: 'Lines', content: 'Grain and rates' },
  { key: 'financials', title: 'Financials', content: 'FX, charges, IGST' },
  { key: 'declarations', title: 'Declarations', content: 'Bank and texts' },
];

/**
 * Export invoice — a five-step wizard on the SampleInvoiceForm model: one state
 * object, one `patch()`, no per-step gate. Navigation is free because the document
 * is validated as a whole (§14): what blocks is Finalise, and the panel says why.
 *
 * Every mutation goes through `run()` and re-reads the decorated invoice, so totals,
 * tax and validation on screen are always the service's answer rather than a local
 * recomputation that could drift from it.
 */
const ExportInvoiceForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null);
  const [reasonCfg, setReasonCfg] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [incoterms, setIncoterms] = useState([]);
  const exporter = useExporterBlock();

  const canUpdate = hasPermission(EXPDOC_MODULE.INVOICE, 'update');
  const canRevisePerm = hasPermission(EXPDOC_MODULE.INVOICE, 'revise');
  const canOverride = hasPermission(EXPDOC_MODULE.INVOICE, 'override');

  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInvoice(id);
      setInv(data);
      setDraft(null);
      setDirty(false);
    } catch (e) {
      setLoadError(e.message || 'Failed to load the invoice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!inv?.shipmentId) return;
    getShipment(inv.shipmentId).then(setShipment).catch(() => setShipment(null));
  }, [inv?.shipmentId]);

  useEffect(() => {
    listIncoterms().then(setIncoterms).catch(() => setIncoterms([]));
  }, []);

  /** One funnel for every mutation: loading, toast and error in a single place. */
  const run = useCallback(async (fn, successMsg) => {
    setSaving(true);
    try {
      const next = await fn();
      setInv(next);
      setDraft(null);
      setDirty(false);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      message.error(e.message || 'The change could not be saved');
      return null;
    } finally {
      setSaving(false);
    }
  }, [message]);

  // Edits accumulate locally so a rate can be typed without a round trip per keystroke;
  // Save is what sends them, and the service is what recomputes the totals.
  const working = useMemo(() => (draft ? { ...inv, ...draft } : inv), [inv, draft]);

  const patch = useCallback((changes) => {
    setDraft((d) => ({ ...(d || {}), ...changes }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    if (!draft) return Promise.resolve(null);
    return run(() => updateInvoice(inv.id, { ...draft, version: inv.version }), 'Saved');
  }, [draft, inv, run]);

  const handleRegenerate = useCallback(() => {
    modal.confirm({
      title: 'Regenerate lines from the packing list?',
      content: 'Lines are rebuilt from the packing lists as they stand now. Rates you have overridden are kept.',
      okText: 'Regenerate',
      onOk: () => run(() => regenerateInvoiceLines(inv.id), 'Lines regenerated'),
    });
  }, [inv, modal, run]);

  const handleChangeGrain = useCallback((mode) => {
    setReasonCfg({
      key: 'grain',
      title: `Change the line grain to "${LINE_GRAIN_LABELS[mode]}"?`,
      label: 'Why is a different grain needed?',
      context: {
        title: 'This changes what the buyer sees',
        message: 'Every line is regenerated at the new grain. Quantities still reconcile to the packing list.',
      },
      okText: 'Change grain',
      onSubmit: (reason) => run(
        () => regenerateInvoiceLines(inv.id, { grain: { mode }, reason }),
        'Line grain changed',
      ),
    });
  }, [inv, run]);

  const handleOverrideFx = useCallback(() => {
    setReasonCfg({
      key: 'fx',
      title: 'Override the exchange rate',
      label: 'Reason for the override',
      context: {
        title: 'The rate is audited',
        message: `Current rate: ${working?.fxRate ?? '—'} (${working?.fxSource === 'MANUAL' ? 'manual' : 'rate master'}). The new rate and this reason are recorded.`,
      },
      okText: 'Apply rate',
      numberField: { label: 'New rate', initial: working?.fxRate },
      onSubmit: (reason, value) => run(
        () => updateInvoice(inv.id, { version: inv.version, fxRate: value, fxOverrideReason: reason }),
        'Exchange rate overridden',
      ),
    });
  }, [inv, working, run]);

  const acknowledge = useCallback((finding) => {
    setReasonCfg({
      key: `ack:${finding.targetKey}`,
      title: finding.title,
      label: 'Why is this acceptable?',
      context: { title: finding.code, message: finding.message },
      okText: 'Acknowledge',
      onSubmit: (reason) => run(
        () => acknowledgeInvoiceWarning(inv.id, finding.targetKey, reason),
        'Warning acknowledged',
      ),
    });
  }, [inv, run]);

  const move = useCallback((next, opts = {}) => run(
    () => changeInvoiceStatus(inv.id, next, opts),
    next === INVOICE_STATUS.FINAL ? 'Final — invoice number allocated' : `Moved to ${INVOICE_STATUS_LABELS[next]}`,
  ), [inv, run]);

  const actions = useMemo(() => {
    if (!working) return null;
    const list = [];
    const editable = working.status === INVOICE_STATUS.DRAFT;

    if (editable && canUpdate) {
      list.push(
        <ActionButton key="save" action="save" text="Save" loading={saving} disabled={!dirty} onClick={save} />,
      );
      // The single gate. Nobody reviews this afterwards, so the tooltip has to name
      // what is blocking rather than leave the user waiting on somebody else.
      list.push(
        <Tooltip key="finalise" title={working.canFinalise ? undefined : (working.finaliseBlockers[0] || 'Resolve the open issues first.')}>
          <span>
            <ActionButton
              action="approve"
              text="Finalise"
              disabled={!working.canFinalise || dirty}
              onClick={() => modal.confirm({
                title: 'Finalise this invoice?',
                content: 'A number is allocated now and the document is frozen. Later prints render from this version. To change it afterwards, Revise creates a new version.',
                okText: 'Finalise',
                onOk: () => move(INVOICE_STATUS.FINAL),
              })}
            />
          </span>
        </Tooltip>,
      );
    }

    if (working.canRevise && canRevisePerm) {
      list.push(
        <ActionButton
          key="revise"
          action="edit"
          text="Revise"
          onClick={() => setReasonCfg({
            key: 'revise',
            title: 'Revise this invoice?',
            label: 'Reason for the revision',
            context: {
              title: 'A new version is created',
              message: 'The number is kept with an -R suffix so the issued series stays gapless. This version becomes superseded and stays viewable.',
            },
            okText: 'Create revision',
            onSubmit: async (reason) => {
              const next = await run(() => reviseInvoice(inv.id, reason), 'Revision created');
              if (next) navigate(`/export-docs/invoices/edit/${next.id}`);
            },
          })}
        />,
      );
    }

    if ([INVOICE_STATUS.FINAL, INVOICE_STATUS.EXPORTED].includes(working.status) && canUpdate) {
      list.push(
        <ActionButton
          key="cancel"
          action="cancel"
          text="Cancel invoice"
          onClick={() => setReasonCfg({
            key: 'cancel',
            title: 'Cancel this invoice?',
            label: 'Reason for cancelling',
            context: {
              title: 'The number is kept',
              message: 'A cancelled invoice retains its number and is never reused, so the issued series stays intact.',
            },
            okText: 'Cancel invoice',
            danger: true,
            onSubmit: (reason) => move(INVOICE_STATUS.CANCELLED, { reason }),
          })}
        />,
      );
    }

    if (working.status === INVOICE_STATUS.FINAL && canUpdate) {
      list.push(
        <Tooltip key="release" title="Mark the invoice released to the buyer or customs broker. Recorded in the audit trail and the shipment register.">
          <span>
            <ActionButton
              action="send"
              text="Mark released"
              onClick={() => run(() => markInvoiceExported(working.id), 'Invoice released')}
            />
          </span>
        </Tooltip>,
      );
    }

    list.push(
      <ActionButton key="preview" action="print" text="Preview &amp; print" onClick={() => setPreviewOpen(true)} />,
    );
    return list;
  }, [working, dirty, saving, canUpdate, canRevisePerm, save, move, modal, run, inv, navigate]);

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Invoice could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to invoices" onClick={() => navigate(LIST_PATH)} />}
      />
    );
  }
  if (loading || !working) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Export Invoice" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 10 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const locked = working.status !== INVOICE_STATUS.DRAFT || !canUpdate;
  const stepProps = { inv: working, patch, locked, exporter };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={working.invoiceNo || working.provisionalNo}
        subtitle={`${working.buyerName} · ${working.shipmentNo || 'no shipment'} · ${working.packingLists?.length || 0} packing list(s)`}
        onBack={() => navigate(LIST_PATH)}
        status={(
          <Space size={6} wrap>
            <StatusTag status={working.status} config={EXPORT_INVOICE_STATUS_CONFIG} labels={INVOICE_STATUS_LABELS} />
            {working.revision > 0 && <Tag color="orange">R{working.revision}</Tag>}
            {working.isStale && <Tag color="gold">built on a changed packing list</Tag>}
          </Space>
        )}
        style={STICKY_HEADER}
      >
        <Space wrap>{actions}</Space>
      </PageHeader>

      {working.isStale && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="A packing list under this invoice has changed"
          description={`${working.staleRefs.map((r) => r.plNo).join(', ')} has been edited since these lines were generated. Regenerate before finalising.`}
          action={!locked && (
            <ActionButton action="refresh" text="Regenerate" size="small" onClick={handleRegenerate} />
          )}
        />
      )}

      {dirty && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Unsaved changes"
          description="Totals, tax and validation update once you save — they are computed by the service, not guessed here."
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={step}
          onChange={setStep}
          size="small"
          items={STEPS.map((s) => ({ title: s.title, content: s.content }))}
          style={{ marginBottom: 20 }}
        />
        {step === 0 && <InvStepSource {...stepProps} />}
        {step === 1 && <InvStepHeader {...stepProps} incoterms={incoterms} />}
        {step === 2 && (
          <InvStepLines
            {...stepProps}
            onRegenerate={handleRegenerate}
            onChangeGrain={handleChangeGrain}
            canOverride={canOverride}
          />
        )}
        {step === 3 && <InvStepFinancials {...stepProps} onOverrideFx={handleOverrideFx} />}
        {step === 4 && <InvStepDeclarations {...stepProps} />}
      </Card>

      <Card title="Validation" size="small">
        <PlValidationPanel
          validation={working.panelFindings}
          canAcknowledge={!locked}
          onAcknowledge={acknowledge}
        />
      </Card>

      <AckReasonModal
        key={reasonCfg?.key || 'none'}
        open={Boolean(reasonCfg)}
        title={reasonCfg?.title}
        label={reasonCfg?.label}
        context={reasonCfg?.context}
        okText={reasonCfg?.okText}
        danger={reasonCfg?.danger}
        minLength={reasonCfg?.minLength}
        numberField={reasonCfg?.numberField}
        confirming={saving}
        onCancel={() => setReasonCfg(null)}
        onSubmit={async (reason, value) => {
          const cfg = reasonCfg;
          setReasonCfg(null);
          await cfg.onSubmit(reason, value);
        }}
      />

      <InvPreviewDrawer
        open={previewOpen}
        inv={working}
        exporter={exporter}
        shipment={shipment}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
};

export default ExportInvoiceForm;
