import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Alert, App, Col, Collapse, Result, Row, Skeleton, Space, Tag, Timeline, Tooltip, Typography,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import StatusSteps from '../../../components/StatusSteps';
import StatCard from '../../../components/StatCard';
import DetailCard from '../../../components/DetailCard';
import DraftWatermark from '../../../components/DraftWatermark';
import { ActionButton } from '../../../components/buttons';
import { PL_STATUS_CONFIG, PL_STATUS_FLOW } from '../../../utils/statusConfig';
import {
  DOC_TYPE, EXPDOC_MODULE, PL_STATUS, PL_STATUS_LABELS, SECTION_KEY,
} from '../../../utils/expDocConstants';
import { hasPermission } from '../../../utils/permissions';
import {
  getPackingList, refreshFromPacking, acknowledgeWarning, changePlStatus, revisePackingList,
  getShipment, markPackingListExported, overridePlTemplate, clearPlTemplateOverride,
  recallPackingList,
  updatePackingList,
} from '../../../services/expdoc/expDocService';
import useExporterBlock from '../shared/useExporterBlock';
import PlCartonGrid from './PlCartonGrid';
import PlValidationPanel from './PlValidationPanel';
import PlOrderVsPackedPanel from './PlOrderVsPackedPanel';
import AckReasonModal from '../shared/AckReasonModal';
import TemplateOverrideModal from '../shared/TemplateOverrideModal';
import PlPreviewDrawer from './PlPreviewDrawer';
import PlHeaderEditor from './PlHeaderEditor';
import PlCompareModal from './PlCompareModal';

const { Text } = Typography;
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const SECTION_KEYS = ['header', 'details', 'cartons', 'totals', 'orderVsPacked', 'validation', 'versions'];

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const panelStyle = (colour) => ({
  background: `color-mix(in srgb, ${colour} 8%, transparent)`,
  borderRadius: 8,
  border: `1px solid color-mix(in srgb, ${colour} 20%, transparent)`,
  marginBottom: 12,
});

const panelLabel = (text, colour, extra) => (
  <Space size={8} wrap>
    <Text strong style={{ fontSize: 15, color: colour }}>{text}</Text>
    {extra}
  </Space>
);

/**
 * Packing list workspace.
 *
 * Structurally the Bill Passing form: a sticky action header over a Collapse of
 * fixed sections, one `run()` funnel for every mutation, and one reason modal for
 * every action that needs a justification.
 *
 * Carton data is read-only throughout — this document binds it, it does not own it.
 */
const PackingListWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reasonCfg, setReasonCfg] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shipment, setShipment] = useState(null);
  const exporter = useExporterBlock();

  const canUpdate = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'update');
  const canApprovePerm = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'approve');
  const canRevisePerm = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'revise');
  const canOverridePerm = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'override');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPl(await getPackingList(id));
    } catch (e) {
      setLoadError(e.message || 'Failed to load the packing list');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Exporter and shipment feed the printed header. Loaded alongside the document so
  // Preview never has to wait, and failures degrade to an em dash on the page.
  useEffect(() => {
    if (!pl?.shipmentId) return;
    getShipment(pl.shipmentId).then(setShipment).catch(() => setShipment(null));
  }, [pl?.shipmentId]);

  /** One funnel for every mutation: loading, toast and error in a single place. */
  const run = useCallback(async (fn, successMsg) => {
    setSaving(true);
    try {
      const next = await fn();
      if (next?.id) setPl(next);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      if (!e.isOptimisticLockConflict) message.error(e.message || 'Action failed');
      return null;
    } finally {
      setSaving(false);
    }
  }, [message]);

  const issuesByRow = useMemo(() => {
    const map = {};
    (pl?.panelFindings?.findings || []).forEach((f) => {
      (f.targets || []).filter((t) => t.type === 'ROW').forEach((t) => {
        map[t.id] = map[t.id] || [];
        map[t.id].push(f);
      });
    });
    return map;
  }, [pl]);

  const openIssues = pl?.panelFindings?.blocking?.length || 0;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAcknowledge = (item) => setReasonCfg({
    key: 'ack',
    title: `Acknowledge ${item.code}`,
    label: 'Why is this acceptable?',
    context: { title: item.title, message: item.message },
    okText: 'Acknowledge',
    onSubmit: (reason) => run(
      () => acknowledgeWarning(pl.id, item, reason),
      'Reason recorded — it will be shown to the approver',
    ),
  });

  const handleSubmit = () => modal.confirm({
    title: 'Submit for approval?',
    content: `${pl.plNo} will be locked for editing and sent to an approver. Every acknowledged warning is shown to them with your reason.`,
    okText: 'Submit',
    onOk: () => run(() => changePlStatus(pl.id, PL_STATUS.SUBMITTED), `${pl.plNo} submitted`),
  });

  const handleApprove = () => modal.confirm({
    title: 'Approve this packing list?',
    content: (
      <Space orientation="vertical" size={4}>
        <Text>Approval snapshots the document and its template version. Later carton changes will flag it stale rather than alter it.</Text>
        {(pl.panelFindings?.warnings || []).filter((w) => w.acknowledged).length > 0 && (
          <Text type="secondary">
            {`${pl.panelFindings.warnings.filter((w) => w.acknowledged).length} acknowledged warning(s) are recorded against this document.`}
          </Text>
        )}
      </Space>
    ),
    okText: 'Approve',
    onOk: () => run(() => changePlStatus(pl.id, PL_STATUS.APPROVED), `${pl.plNo} approved`),
  });

  const handleSendBack = () => setReasonCfg({
    key: 'sendback',
    title: 'Send back to draft',
    label: 'What needs changing?',
    okText: 'Send back',
    danger: true,
    onSubmit: (reason) => run(() => changePlStatus(pl.id, PL_STATUS.DRAFT, reason), `${pl.plNo} returned to draft`),
  });

  const handleRevise = () => setReasonCfg({
    key: 'revise',
    title: 'Revise this packing list',
    label: 'Reason for the revision',
    context: {
      title: 'A revision creates a new draft',
      message: 'The number stays the same and the current version is marked superseded, so the buyer keeps referencing one packing list.',
    },
    okText: 'Create revision',
    onSubmit: async (reason) => {
      const next = await run(() => revisePackingList(pl.id, reason), 'Revision created');
      if (next?.id) navigate(`/export-docs/packing-lists/edit/${next.id}`, { replace: true });
    },
  });

  const handleCancel = () => setReasonCfg({
    key: 'cancel',
    title: 'Cancel this packing list',
    label: 'Reason for cancelling',
    okText: 'Cancel packing list',
    danger: true,
    onSubmit: (reason) => run(() => changePlStatus(pl.id, PL_STATUS.CANCELLED, reason), `${pl.plNo} cancelled`),
  });

  const headerActions = useMemo(() => {
    if (!pl) return null;
    const actions = [];
    if (pl.status === PL_STATUS.DRAFT) {
      if (canUpdate && pl.canRefresh) {
        actions.push(
          <ActionButton key="refresh" action="refresh" text="Refresh from packing" loading={saving}
            onClick={() => run(() => refreshFromPacking(pl.id), 'Carton data refreshed')} />,
        );
      }
      if (canUpdate) {
        actions.push(
          <Tooltip key="submit" title={pl.canSubmit ? undefined : `Blocked — ${pl.submitBlockers[0] || 'open issues'}`}>
            <span>
              <ActionButton action="send" text="Submit" loading={saving} disabled={!pl.canSubmit} onClick={handleSubmit} />
            </span>
          </Tooltip>,
        );
      }
    }

    if (pl.status === PL_STATUS.SUBMITTED) {
      // The author's own recall — no approver needed, and recorded as their decision.
      if (pl.canRecall && canUpdate) {
        actions.push(
          <ActionButton
            key="recall"
            action="undo"
            text="Recall submission"
            loading={saving}
            onClick={() => setReasonCfg({
              key: 'recall',
              title: 'Recall this submission?',
              label: 'Why are you taking it back? (optional)',
              minLength: 0,
              context: {
                title: 'It returns to draft',
                message: 'Nobody has approved it yet, so it comes straight back to you for editing.',
              },
              okText: 'Recall',
              onSubmit: (reason) => run(() => recallPackingList(pl.id, reason), `${pl.plNo} recalled`),
            })}
          />,
        );
      }

      // Sending a document back is the reviewer’s alternative to approving it, so it
      // is gated on `approve` — matching the invoice. On `update` it let any editor
      // bounce a document out of somebody else’s review queue.
      if (canApprovePerm) {
        actions.push(<ActionButton key="back" action="refer-back" text="Send back" loading={saving} onClick={handleSendBack} />);
      }
      if (canApprovePerm) {
        actions.push(
          <Tooltip key="approve" title={pl.approveBlockedReason || undefined}>
            <span>
              <ActionButton action="approve" text="Approve" loading={saving} disabled={!pl.canApprove} onClick={handleApprove} />
            </span>
          </Tooltip>,
        );
      }
    }

    if ([PL_STATUS.APPROVED, PL_STATUS.EXPORTED].includes(pl.status)) {
      if (canRevisePerm) {
        actions.push(<ActionButton key="revise" action="history" text="Revise" loading={saving} onClick={handleRevise} />);
      }
      if (canApprovePerm) {
        actions.push(<ActionButton key="cancel" action="cancel" text="Cancel" loading={saving} onClick={handleCancel} />);
      }
    }

    // §16: Approved -> Exported is the release. Printing alone recorded nothing, so
    // the register had no export date and the status was unreachable.
    if (pl.status === PL_STATUS.APPROVED && canUpdate) {
      actions.push(
        <Tooltip key="release" title="Mark the documents released to the buyer or forwarder. Recorded in the audit trail and the shipment register.">
          <span>
            <ActionButton
              action="send"
              text="Mark released"
              onClick={() => run(() => markPackingListExported(pl.id), 'Documents released')}
            />
          </span>
        </Tooltip>,
      );
    }

    actions.push(
      <ActionButton key="preview" action="print" text="Preview & print" onClick={() => setPreviewOpen(true)} />,
    );
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl, saving, canUpdate, canApprovePerm, canRevisePerm, run, message]);

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Packing list could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to packing lists" onClick={() => navigate('/export-docs/packing-lists/list')} />}
      />
    );
  }

  if (loading || !pl) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Packing List" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const items = [
    {
      key: 'header',
      label: panelLabel('Document', 'var(--primary-color)', <Tag>{pl.template?.name || 'No template'}</Tag>),
      style: panelStyle('var(--primary-color)'),
      children: (
        <DetailCard title={null}>
          <DetailCard.Field label="Packing list no." value={pl.plNo} />
          <DetailCard.Field label="Date" value={pl.plDate} />
          <DetailCard.Field label="Revision" value={pl.revision || 0} />
          <DetailCard.Field label="Shipment" value={pl.shipmentNo} />
          <DetailCard.Field label="Buyer" value={pl.buyerName} />
          <DetailCard.Field label="Sub-client" value={pl.subClientCode} />
          <DetailCard.Field label="Orders" value={(pl.orderNos || []).join(', ')} />
          <DetailCard.Field
            label="Template"
            value={(
              <Space size={6} wrap>
                <Text>{pl.template ? `${pl.template.name} v${pl.template.version}` : '—'}</Text>
                {pl.templateOverride && (
                  <Tooltip title={`Overridden by ${pl.templateOverride.user} on ${pl.templateOverride.at} — ${pl.templateOverride.reason}`}>
                    <Tag color="warning">Overridden</Tag>
                  </Tooltip>
                )}
                {/* §10.2: the override is a permissioned act on one document, so the
                    control lives beside the value it changes rather than in the toolbar. */}
                {pl.status === PL_STATUS.DRAFT && canOverridePerm && (
                  <a onClick={() => setOverrideOpen(true)}>Change</a>
                )}
                {pl.status === PL_STATUS.DRAFT && canOverridePerm && pl.templateOverride && (
                  <a onClick={() => run(() => clearPlTemplateOverride(pl.id), 'Back to the buyer default')}>
                    Use the buyer default
                  </a>
                )}
              </Space>
            )}
          />
          <DetailCard.Field
            label="Bound packing entries"
            value={(pl.sourceRefs || []).map((r) => `${r.packingNo} v${r.packingEntryVersion}`).join(', ')}
          />
        </DetailCard>
      ),
    },
    {
      key: 'details',
      label: panelLabel(
        'Document details',
        'var(--warning-color)',
        pl.status === PL_STATUS.DRAFT && canUpdate
          ? <Tag color="processing">Editable</Tag>
          : <Tag>Locked</Tag>,
      ),
      style: panelStyle('var(--warning-color)'),
      children: (pl.status === PL_STATUS.DRAFT && canUpdate
        ? (
          // §12.1: the fields the document owns. Keyed on the version so a save
          // anywhere reseeds the inputs from the stored record.
          <PlHeaderEditor
            key={pl.version}
            pl={pl}
            saving={saving}
            onSave={(values) => run(
              () => updatePackingList(pl.id, { ...values, version: pl.version }),
              'Document details saved',
            )}
          />
        )
        : (
          <DetailCard title={null}>
            <DetailCard.Field label="Description of goods" value={pl.descriptionOfGoods} />
            <DetailCard.Field label="Marks & numbers" value={pl.marksAndNos || pl.cartonRangeLabel} />
            <DetailCard.Field label="Consignee" value={pl.resolved?.consignee?.name} />
            <DetailCard.Field label="Delivery centre" value={pl.resolved?.deliveryCentre} />
            <DetailCard.Field label="Container no." value={pl.resolved?.containerNo} />
            <DetailCard.Field label="Seal no." value={pl.resolved?.sealNo} />
            <DetailCard.Field label="Remarks" value={pl.remarks} span={16} />
          </DetailCard>
        )
      ),
    },
    {
      key: 'cartons',
      label: panelLabel('Cartons', 'var(--info-color)', <Tag>{`${num(pl.totals.cartons)} cartons`}</Tag>),
      style: panelStyle('var(--info-color)'),
      children: (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {(pl.sections || []).map((section) => (
            <div key={section.key}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {section.title}
                {section.key === SECTION_KEY.EXTRA && (
                  <Text type="secondary" style={{ fontWeight: 400, marginInlineStart: 8, fontSize: 12 }}>
                    Reported separately, included in the grand total
                  </Text>
                )}
              </Text>
              <PlCartonGrid
                section={section}
                sizes={pl.sizes || []}
                template={pl.template}
                issuesByRow={issuesByRow}
              />
            </div>
          ))}
        </Space>
      ),
    },
    {
      key: 'totals',
      label: panelLabel('Grand total', 'var(--secondary-color)'),
      style: panelStyle('var(--secondary-color)'),
      children: (
        <>
          <Row gutter={[12, 12]} align="stretch">
            <Col xs={12} md={6}><StatCard title="Cartons" value={num(pl.totals.cartons)} color="var(--primary-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Pieces" value={num(pl.totals.pieces)} color="var(--info-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Net weight (kg)" value={num(pl.totals.netWeightKg, 3)} color="var(--secondary-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Gross weight (kg)" value={num(pl.totals.grossWeightKg, 3)} color="var(--accent-color)" /></Col>
          </Row>
          <Row gutter={[12, 12]} align="stretch" style={{ marginTop: 12 }}>
            <Col xs={12} md={6}><StatCard title="CBM" value={num(pl.totals.cbm, 3)} color="var(--success-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Net / piece (kg)" value={pl.weightPerPiece.netPerPiece} color="var(--text-secondary)" /></Col>
            <Col xs={12} md={6}><StatCard title="Gross / piece (kg)" value={pl.weightPerPiece.grossPerPiece} color="var(--text-secondary)" /></Col>
            <Col xs={12} md={6}><StatCard title="Carton numbers" value={pl.cartonRangeLabel || '—'} color="var(--info-color)" /></Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
            Weight per piece is shown to 5 decimals, as some buyer templates require.
          </Text>
        </>
      ),
    },
    {
      key: 'orderVsPacked',
      label: panelLabel('Order vs shipped', 'var(--accent-color)'),
      style: panelStyle('var(--accent-color)'),
      children: <PlOrderVsPackedPanel rows={pl.orderVsPacked || []} tolerancePercent={pl.tolerancePercent} />,
    },
    {
      key: 'validation',
      label: panelLabel(
        'Validation',
        openIssues ? 'var(--error-color)' : 'var(--success-color)',
        openIssues ? <Tag color="red">{`${openIssues} blocking`}</Tag> : <Tag color="green">Clear</Tag>,
      ),
      style: panelStyle(openIssues ? 'var(--error-color)' : 'var(--success-color)'),
      children: (
        <PlValidationPanel
          validation={pl.panelFindings}
          canAcknowledge={canUpdate && pl.status === PL_STATUS.DRAFT}
          onAcknowledge={handleAcknowledge}
        />
      ),
    },
    {
      key: 'versions',
      label: panelLabel(
        'History',
        'var(--text-secondary)',
        (pl.revisions || []).length > 1 ? <Tag>{`${pl.revisions.length} revisions`}</Tag> : null,
      ),
      style: panelStyle('var(--text-secondary)'),
      children: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {/* §17: revisions are written; until now nothing read them back. Any two
              can be compared, because "what changed since the one the buyer signed"
              is rarely the immediately preceding revision. */}
          {(pl.revisions || []).length > 1 && (
            <Space wrap size={8}>
              {pl.revisions.map((r) => (
                <Tag
                  key={r.id}
                  color={r.isCurrent ? 'blue' : undefined}
                  style={{ cursor: r.isCurrent ? 'default' : 'pointer' }}
                  onClick={() => (r.isCurrent ? null : navigate(`/export-docs/packing-lists/edit/${r.id}`))}
                >
                  {`R${r.revision} · ${String(r.status).toLowerCase()}`}
                </Tag>
              ))}
              <ActionButton action="view" text="Compare revisions" size="small" onClick={() => setCompareOpen(true)} />
            </Space>
          )}
        <Timeline
          items={[
            { content: `Created by ${pl.createdBy} on ${pl.createdAt}` },
            ...(pl.submittedBy ? [{ content: `Submitted by ${pl.submittedBy}`, color: 'blue' }] : []),
            ...(pl.approvedBy ? [{ content: `Approved by ${pl.approvedBy} on ${pl.approvalSnapshot?.at}`, color: 'green' }] : []),
            ...(pl.reviseReason ? [{ content: `Revision ${pl.revision}: ${pl.reviseReason}`, color: 'orange' }] : []),
            ...(pl.supersededByPlId ? [{ content: 'Superseded by a later revision', color: 'gray' }] : []),
            ...(pl.cancelReason ? [{ content: `Cancelled: ${pl.cancelReason}`, color: 'red' }] : []),
          ]}
        />
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={pl.plNo}
        subtitle={`${pl.buyerName || '—'} · ${pl.shipmentNo || '—'} · ${num(pl.totals.cartons)} cartons`}
        onBack={() => navigate('/export-docs/packing-lists/list')}
        status={(
          <Space size={6}>
            <StatusTag status={pl.status} config={PL_STATUS_CONFIG} getLabel={(s) => PL_STATUS_LABELS[s] || s} />
            {pl.revision > 0 && <Tag color="orange">{`R${pl.revision}`}</Tag>}
          </Space>
        )}
        style={STICKY_HEADER}
      >
        {headerActions}
      </PageHeader>

      <StatusSteps
        statusFlow={PL_STATUS_FLOW}
        currentStatus={pl.status}
        statusConfig={PL_STATUS_CONFIG}
        getLabel={(s) => PL_STATUS_LABELS[s] || s}
        size="small"
      />

      {pl.isStale && (
        <Alert
          type="info"
          showIcon
          style={{ margin: '16px 0' }}
          title="Carton data has changed since this packing list was built"
          description={(
            <Space orientation="vertical" size={2}>
              <Text>
                {pl.staleSources.map((s) => `${s.packingNo} moved from v${s.from} to v${s.to}`).join('; ')}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {pl.canRefresh
                  ? 'Refresh from packing to pull the corrections in.'
                  : 'This document is locked. Revise it to pull newer carton data.'}
              </Text>
            </Space>
          )}
        />
      )}

      {exporter && !exporter.block && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '16px 0' }}
          title="Exporter details are not configured"
          description="Organisation Info has no record, so the exporter block will print blank. Add it under Admin to complete the document header."
        />
      )}

      {pl.templateIsFallback && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '16px 0' }}
          title="No buyer template configured"
          description="This packing list is using the standard export template. Configure one for this buyer to match their required layout."
        />
      )}

      <div style={{ marginTop: 16 }}>
        <DraftWatermark status={pl.status} draftStatuses={[PL_STATUS.DRAFT, PL_STATUS.SUBMITTED]}>
          <Collapse defaultActiveKey={SECTION_KEYS} items={items} />
        </DraftWatermark>
      </div>

      <PlPreviewDrawer
        open={previewOpen}
        pl={pl}
        exporter={exporter}
        shipment={shipment}
        onClose={() => setPreviewOpen(false)}
      />

      <PlCompareModal
        key={compareOpen ? `cmp-${pl.id}` : 'cmp-closed'}
        open={compareOpen}
        pl={pl}
        onCancel={() => setCompareOpen(false)}
      />

      <TemplateOverrideModal
        open={overrideOpen}
        docType={DOC_TYPE.PACKING_LIST}
        buyerCode={pl.buyerCode}
        currentTemplateId={pl.templateId}
        currentLabel={pl.template ? `${pl.template.templateCode} v${pl.template.version}` : 'No template'}
        confirming={saving}
        onCancel={() => setOverrideOpen(false)}
        onSubmit={async (templateId, reason) => {
          const next = await run(() => overridePlTemplate(pl.id, templateId, reason), 'Template overridden for this document');
          if (next?.id) setOverrideOpen(false);
        }}
      />

      <AckReasonModal
        key={reasonCfg?.key || 'none'}
        open={Boolean(reasonCfg)}
        title={reasonCfg?.title}
        label={reasonCfg?.label}
        context={reasonCfg?.context}
        okText={reasonCfg?.okText}
        danger={reasonCfg?.danger}
        minLength={reasonCfg?.minLength}
        confirming={saving}
        onCancel={() => setReasonCfg(null)}
        onSubmit={async (reason) => {
          const cfg = reasonCfg;
          setReasonCfg(null);
          await cfg.onSubmit(reason);
        }}
      />
    </div>
  );
};

export default PackingListWorkspace;
