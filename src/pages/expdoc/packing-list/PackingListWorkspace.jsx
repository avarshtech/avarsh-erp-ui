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
  updatePackingList,
} from '../../../services/expdoc/expDocService';
import useExporterBlock from '../shared/useExporterBlock';
import useBusyAction from '../../../hooks/useBusyAction';
import PlCartonGrid from './PlCartonGrid';
import PlValidationPanel from './PlValidationPanel';
import PlOrderVsPackedPanel from './PlOrderVsPackedPanel';
import AckReasonModal from '../shared/AckReasonModal';
import TemplateOverrideModal from '../shared/TemplateOverrideModal';
import PlPreviewDrawer from './PlPreviewDrawer';
import PlHeaderEditor from './PlHeaderEditor';
import PlCompareModal from './PlCompareModal';

const { Text } = Typography;
const LIST_PATH = '/export-docs/packing-lists/list';
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
  // The key of the mutation in flight (see `run`), so only that action's button spins.
  const { busy, setBusy, busyProps } = useBusyAction();
  const [loadError, setLoadError] = useState(null);
  const [reasonCfg, setReasonCfg] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shipment, setShipment] = useState(null);
  // Reported up by PlHeaderEditor, so Exit can warn instead of silently discarding.
  const [headerDirty, setHeaderDirty] = useState(false);
  const exporter = useExporterBlock();

  const canUpdate = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'update');
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

  /**
   * One funnel for every mutation: loading, toast and error in a single place.
   * `key` names the action so its own button (via `busyProps(key)`) is the one that spins.
   */
  const run = useCallback(async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const next = await fn();
      if (next?.id) setPl(next);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      if (!e.isOptimisticLockConflict) message.error(e.message || 'Action failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy]);

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
      'ack',
      () => acknowledgeWarning(pl.id, item, reason),
      'Reason recorded against this document',
    ),
  });

  const handleFinalise = () => modal.confirm({
    title: 'Finalise this packing list?',
    content: (
      <Space orientation="vertical" size={4}>
        <Text>
          {`${pl.plNo} is locked for editing and snapshotted with its template version. Stickers and the export invoice can be raised from it, and later carton changes flag it stale rather than alter it.`}
        </Text>
        <Text type="secondary">To change it afterwards, Revise creates a new draft under the same number.</Text>
        {(pl.panelFindings?.warnings || []).filter((w) => w.acknowledged).length > 0 && (
          <Text type="secondary">
            {`${pl.panelFindings.warnings.filter((w) => w.acknowledged).length} acknowledged warning(s) are recorded against this document.`}
          </Text>
        )}
      </Space>
    ),
    okText: 'Finalise',
    onOk: () => run('finalise', () => changePlStatus(pl.id, PL_STATUS.FINAL), `${pl.plNo} finalised`),
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
      const next = await run('revise', () => revisePackingList(pl.id, reason), 'Revision created');
      if (next?.id) navigate(`/export-docs/packing-lists/edit/${next.id}`, { replace: true });
    },
  });

  const handleExit = useCallback(() => {
    if (!headerDirty) { navigate(LIST_PATH); return; }
    modal.confirm({
      title: 'Leave without saving?',
      content: 'The document details you changed have not been saved. Leaving discards them.',
      okText: 'Discard and exit',
      okButtonProps: { danger: true },
      cancelText: 'Stay',
      onOk: () => navigate(LIST_PATH),
    });
  }, [headerDirty, modal, navigate]);

  const handleCancel = () => setReasonCfg({
    key: 'cancel',
    title: 'Cancel this packing list',
    label: 'Reason for cancelling',
    okText: 'Cancel packing list',
    danger: true,
    onSubmit: (reason) => run('cancel', () => changePlStatus(pl.id, PL_STATUS.CANCELLED, reason), `${pl.plNo} cancelled`),
  });

  const headerActions = useMemo(() => {
    if (!pl) return null;
    const actions = [];
    if (pl.status === PL_STATUS.DRAFT) {
      if (canUpdate && pl.canRefresh) {
        actions.push(
          <ActionButton key="refresh" action="refresh" text="Refresh from packing" {...busyProps('refresh')}
            onClick={() => run('refresh', () => refreshFromPacking(pl.id), 'Carton data refreshed')} />,
        );
      }
      // The single gate. There is no approver behind it, so the tooltip has to name
      // what is blocking rather than leave the user waiting on somebody else.
      if (canUpdate) {
        actions.push(
          <Tooltip key="finalise" title={pl.canFinalise ? undefined : `Blocked — ${pl.finaliseBlockers[0] || 'open issues'}`}>
            <span>
              <ActionButton action="approve" text="Finalise" {...busyProps('finalise', !pl.canFinalise)} onClick={handleFinalise} />
            </span>
          </Tooltip>,
        );
      }
    }

    if ([PL_STATUS.FINAL, PL_STATUS.EXPORTED].includes(pl.status)) {
      if (canRevisePerm) {
        actions.push(<ActionButton key="revise" action="history" text="Revise" {...busyProps('revise')} onClick={handleRevise} />);
      }
      if (canUpdate) {
        actions.push(<ActionButton key="cancel" action="cancel" text="Cancel" {...busyProps('cancel')} onClick={handleCancel} />);
      }
    }

    // §16: Final -> Released is the release. Printing alone recorded nothing, so
    // the register had no export date and the status was unreachable.
    if (pl.status === PL_STATUS.FINAL && canUpdate) {
      actions.push(
        <Tooltip key="release" title="Mark the documents released to the buyer or forwarder. Recorded in the audit trail and the shipment register.">
          <span>
            <ActionButton
              action="send"
              text="Mark released"
              {...busyProps('release')}
              onClick={() => run('release', () => markPackingListExported(pl.id), 'Documents released')}
            />
          </span>
        </Tooltip>,
      );
    }

    actions.push(
      <ActionButton key="preview" action="print" text="Preview & print" onClick={() => setPreviewOpen(true)} />,
    );
    // The way out of a long document. The back arrow is easy to lose once the page
    // is scrolled, and the header is sticky — so Exit is always reachable.
    actions.push(
      <ActionButton key="exit" action="close" text="Exit" onClick={handleExit} />,
    );
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl, busyProps, canUpdate, canRevisePerm, run, message]);

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Packing list could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back to packing lists" onClick={() => navigate(LIST_PATH)} />}
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
                  <a onClick={() => run('template', () => clearPlTemplateOverride(pl.id), 'Back to the buyer default')}>
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
            saving={busy === 'header'}
            onDirtyChange={setHeaderDirty}
            onSave={(values) => run(
              'header',
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
            ...(pl.finalisedBy ? [{ content: `Finalised by ${pl.finalisedBy} on ${pl.finalSnapshot?.at}`, color: 'green' }] : []),
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
        onBack={handleExit}
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
        <DraftWatermark status={pl.status} draftStatuses={[PL_STATUS.DRAFT]}>
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
        confirming={busy === 'template'}
        onCancel={() => setOverrideOpen(false)}
        onSubmit={async (templateId, reason) => {
          const next = await run('template', () => overridePlTemplate(pl.id, templateId, reason), 'Template overridden for this document');
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
        confirming={busy !== null}
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
