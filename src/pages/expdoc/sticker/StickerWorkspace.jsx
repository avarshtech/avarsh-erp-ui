import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Alert, App, Button, Card, Checkbox, Col, InputNumber, Pagination, Result, Row,
  Segmented, Skeleton, Space, Switch, Tag, Tooltip, Typography,
} from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { integerInputProps } from '../../../utils/inputHelpers';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE, PAPER_LIST, PAPER_SPECS, PL_STATUS } from '../../../utils/expDocConstants';

/** A sticker prints clean only from a packing list that is actually approved. */
const APPROVED_PL_STATUSES = [PL_STATUS.APPROVED, PL_STATUS.EXPORTED];
import { buildStickerSheetHtml, stickerCounts } from '../../../utils/expDocHtml';
import { intersectRanges, formatRanges } from '../../../utils/expDocCalc';
import { openPrintWindow, documentFileName } from '../../../utils/printDoc';
import {
  getStickerContext, previewCartons, checkStickerGeneration, generateStickerRun, cartonPrintHistory,
} from '../../../services/expdoc/expDocService';
import AckReasonModal from '../shared/AckReasonModal';
import useExporterBlock from '../shared/useExporterBlock';

const { Text } = Typography;
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
// CSS px per mm at the 96 dpi the document is authored against.
const MM_PX = 96 / 25.4;
const PREVIEW_H = 620;
/*
 * Carton counts follow the buyer's order quantity, so a shipment has no ceiling.
 * Assembling the HTML is not the constraint — 20,000 cartons × 2 faces builds in
 * well under a second — but the browser's own print pipeline is, and it fails by
 * hanging rather than by erroring. Past this many labels the user is offered a
 * range instead of a job the printer may never come back from.
 */
const MAX_LABELS_PER_JOB = 2000;
const SCOPE = { ALL: 'All cartons', RANGE: 'Range', SELECTION: 'Specific cartons' };

const num = (v) => (Number(v) || 0).toLocaleString('en-IN');

/**
 * Sticker generation for one packing list.
 *
 * Carton counts follow the buyer's order quantity, so nothing here assumes a
 * ceiling. The preview renders ONE SHEET at a time behind a pager — the full set is
 * never mounted — and only the requested scope is ever expanded.
 */
const StickerWorkspace = () => {
  const { plId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [ctx, setCtx] = useState(null);
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reasonCfg, setReasonCfg] = useState(null);

  const [scopeMode, setScopeMode] = useState(SCOPE.ALL);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [paper, setPaper] = useState();
  const [faceKeys, setFaceKeys] = useState([]);
  const [barcodeOn, setBarcodeOn] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [pageCartons, setPageCartons] = useState([]);
  const [history, setHistory] = useState(null);
  const [paneW, setPaneW] = useState(0);
  // null = fit the pane; a number is an explicit zoom the user chose.
  const [zoom, setZoom] = useState(null);
  const roRef = useRef(null);
  const exporter = useExporterBlock();

  const canPrint = hasPermission(EXPDOC_MODULE.STICKERS, 'print');
  const canReprint = hasPermission(EXPDOC_MODULE.STICKERS, 'reprint');
  const canOverride = hasPermission(EXPDOC_MODULE.STICKERS, 'override');

  const scope = useMemo(() => {
    if (scopeMode === SCOPE.RANGE && from && to) return { mode: 'RANGE', from, to };
    return { mode: 'ALL' };
  }, [scopeMode, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getStickerContext(plId, { scope });
      setCtx(c);
      setPaper((p) => p || c.layout?.stickerLayout?.paperDefault || 'A4_1UP');
      setFaceKeys((f) => (f.length ? f : (c.layout?.stickerLayout?.faces || []).map((x) => x.key)));
      setCheck(await checkStickerGeneration(plId, { scope }));
    } catch (e) {
      setLoadError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [plId, scope]);

  useEffect(() => { load(); }, [load]);

  /*
   * The preview is the print document at true scale, shrunk to fit — not a re-layout.
   * Measuring the pane is what lets a 297 mm sheet be shown whole instead of clipped.
   * A callback ref rather than an effect: the pane mounts only after the skeleton is
   * replaced, by which time a mount-time effect has already run against nothing.
   */
  const paneRef = useCallback((node) => {
    roRef.current?.disconnect();
    if (!node || typeof ResizeObserver === 'undefined') return;
    roRef.current = new ResizeObserver(([e]) => setPaneW(e.contentRect.width));
    roRef.current.observe(node);
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  // A reprint is only a reprint if THIS selection was printed before — printing
  // cartons 61–80 after 1–60 is a first print, so it neither needs the reprint
  // right nor a reason.
  const printedOverlap = useMemo(
    () => intersectRanges(ctx?.selectedRanges || [], ctx?.printedRanges || []),
    [ctx],
  );

  const spec = useMemo(
    () => (ctx?.layout ? stickerCounts(ctx.selectedCount, ctx.layout.stickerLayout, paper, faceKeys) : null),
    [ctx, paper, faceKeys],
  );

  /*
   * A preview page is a whole number of SHEETS holding a whole number of CARTONS —
   * which is not the same thing. Two faces on 1-up paper puts one carton across two
   * sheets; one face on 2×2 paper puts four cartons on one sheet. The smallest block
   * that divides cleanly both ways is lcm(labelsPerSheet, faces) labels, so the
   * preview never shows half a carton or half a sheet.
   */
  const { cartonsPerPage, sheetsPerPage, pageCount } = useMemo(() => {
    const perSheet = (PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP).cols * (PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP).rows;
    const faces = Math.max(1, spec?.faces || 1);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const blockLabels = (perSheet * faces) / gcd(perSheet, faces);
    const perPage = blockLabels / faces;
    return {
      cartonsPerPage: perPage,
      sheetsPerPage: blockLabels / perSheet,
      pageCount: Math.max(1, Math.ceil((ctx?.selectedCount || 0) / perPage)),
    };
  }, [paper, spec?.faces, ctx?.selectedCount]);

  /* The iframe is rendered at the paper's true pixel size and scaled down, so what
     is on screen is the print document, not an approximation of it. */
  const sheetPx = useMemo(() => {
    const spc = PAPER_SPECS[paper] || PAPER_SPECS.A4_1UP;
    const w = spc.pageMm[0] * MM_PX;
    const h = spc.pageMm[1] * MM_PX * sheetsPerPage;
    const avail = Math.max(0, paneW - 8);
    const fit = avail ? Math.min(1, avail / w, PREVIEW_H / h) : 1;
    // Fit is the default because the whole sheet has to be checkable at a glance;
    // zoom is what makes a 6pt carton weight readable without printing it.
    return { w, h, scale: zoom ?? fit, fit };
  }, [paper, sheetsPerPage, paneW, zoom]);

  // Only the cartons on the visible page are materialised.
  useEffect(() => {
    if (!ctx?.layout) return;
    previewCartons(plId, { scope, page: sheetIndex, pageSize: cartonsPerPage })
      .then((r) => setPageCartons(r.cartons))
      .catch(() => setPageCartons([]));
  }, [plId, scope, sheetIndex, cartonsPerPage, ctx?.layout]);

  // Changing paper or faces re-pages the preview; page 7 of 61 may not exist at 4-up.
  useEffect(() => { setSheetIndex((i) => Math.min(i, pageCount - 1)); }, [pageCount]);

  /*
   * The render context a face resolves its bindings against. It must carry every
   * namespace the field catalogue offers — a face binding `buyer.name` (JOMO's 22pt
   * headline) printed an em dash while this held only the exporter and the shipment.
   */
  const plStatus = ctx?.pl?.status;
  const stickerCtx = useMemo(() => ({
    exporter: exporter || {},
    shipment: ctx?.shipment || {},
    buyer: { name: ctx?.pl?.buyerName, subClient: ctx?.pl?.subClientCode },
    pl: ctx?.pl || {},
    // The sticker template's own logo switch, not the packing list's.
    showLogo: ctx?.layout?.identity?.showLogo === true,
  }), [exporter, ctx]);


  const layoutWithBarcode = useMemo(() => {
    if (!ctx?.layout) return null;
    const l = JSON.parse(JSON.stringify(ctx.layout.stickerLayout));
    l.faces = l.faces.map((f) => (f.barcode ? { ...f, barcode: { ...f.barcode, enabled: barcodeOn } } : f));
    return l;
  }, [ctx, barcodeOn]);

  const previewHtml = useMemo(() => {
    if (!layoutWithBarcode || !pageCartons.length) return '';
    return buildStickerSheetHtml(pageCartons, {
      layout: layoutWithBarcode,
      paper,
      faceKeys,
      // §16: a sticker inherits the packing list's state. Anything short of
      // approved is provisional, not just a DRAFT — a SUBMITTED list printed clean.
      draft: !APPROVED_PL_STATUSES.includes(plStatus),
      ctx: stickerCtx,
    });
  }, [layoutWithBarcode, pageCartons, paper, faceKeys, stickerCtx, plStatus]);

  const doGenerate = useCallback(async (extra = {}) => {
    setBusy(true);
    try {
      const run = await generateStickerRun(plId, { scope, paper, faceKeys, ...extra });
      // The whole scope is built here, off the render path, and handed straight to
      // the print window as one document.
      const all = await previewCartons(plId, { scope, page: 0, pageSize: run.cartonCount });
      const html = buildStickerSheetHtml(all.cartons, {
        layout: layoutWithBarcode,
        paper,
        faceKeys,
        draft: run.fromDraft,
        title: documentFileName({ docType: 'Stickers', buyer: ctx.pl.buyerName, docNo: run.runNo }),
        ctx: stickerCtx,
      });
      if (!openPrintWindow(html)) {
        message.warning('Your browser blocked the print window. Allow pop-ups and use Reprint from the history.');
      }
      message.success(`${run.runNo} — ${num(run.labelCount)} label(s) for cartons ${ctx.selectedLabel}`);
      await load();
    } catch (e) {
      message.error(e.message || 'Could not generate stickers');
    } finally {
      setBusy(false);
    }
  }, [plId, scope, paper, faceKeys, layoutWithBarcode, ctx, stickerCtx, message, load]);

  /** Switch to a range covering the first batch, so the offer is one click. */
  const takeFirstBatch = useCallback(() => {
    const batch = Math.max(1, Math.floor(MAX_LABELS_PER_JOB / Math.max(1, spec?.faces || 1)));
    const first = (ctx?.selectedRanges || [])[0]?.from ?? 1;
    setScopeMode(SCOPE.RANGE);
    setFrom(first);
    setTo(first + batch - 1);
    setSheetIndex(0);
  }, [spec?.faces, ctx?.selectedRanges]);

  const handleGenerate = () => {
    if ((spec?.labels || 0) > MAX_LABELS_PER_JOB) {
      // "Print everything anyway" is a button inside the dialog rather than the
      // cancel action, because cancel also fires on a dismiss — and dismissing a
      // warning must never be what starts the job it warned about.
      let inst;
      inst = modal.confirm({
        title: 'That is a very large print job',
        width: 560,
        content: (
          <Space orientation="vertical" size={8}>
            <Text>
              {`${num(spec.labels)} labels across ${num(spec.sheets)} sheets would go to the printer as one document. Browsers commonly stall on jobs this size.`}
            </Text>
            <Text type="secondary">
              {`Printing in batches of about ${num(Math.floor(MAX_LABELS_PER_JOB / Math.max(1, spec.faces)))} cartons keeps each job manageable, and each batch is recorded as its own run.`}
            </Text>
            <Button
              danger
              size="small"
              onClick={() => { inst.destroy(); proceedGenerate(); }}
            >
              Print everything anyway
            </Button>
          </Space>
        ),
        // It narrows the range for review; the user then presses Generate. Naming it
        // "Print" promised something this button does not do.
        okText: 'Use the first batch',
        cancelText: 'Cancel',
        onOk: takeFirstBatch,
      });
      return;
    }
    proceedGenerate();
  };

  function proceedGenerate() {
    if (check?.requiresOverride) {
      setReasonCfg({
        key: 'override',
        title: 'Print from a draft packing list?',
        label: 'Why is printing before approval necessary?',
        context: {
          title: 'This packing list is not approved',
          message: 'The labels will carry a DRAFT watermark, and the run is recorded as printed from a draft.',
        },
        okText: 'Print draft labels',
        danger: true,
        onSubmit: (reason) => doGenerate({ overrideReason: reason }),
      });
      return;
    }
    if (printedOverlap.length) {
      setReasonCfg({
        key: 'reprint',
        title: 'Reprint these cartons?',
        label: 'Reason for reprinting',
        context: { title: 'Some of these cartons were printed already', message: `Printed before: ${formatRanges(printedOverlap)}` },
        okText: 'Reprint',
        onSubmit: (reason) => doGenerate({ isReprint: true, reprintReason: reason }),
      });
      return;
    }
    modal.confirm({
      title: 'Generate carton stickers?',
      content: `${num(spec?.labels)} label(s) across ${num(spec?.sheets)} sheet(s) for cartons ${ctx.selectedLabel}.`,
      okText: 'Generate & print',
      onOk: () => doGenerate(),
    });
  }

  if (loadError) {
    return (
      <Result
        status="warning"
        title="Stickers could not be opened"
        subTitle={loadError}
        extra={<ActionButton action="back" text="Back" onClick={() => navigate('/export-docs/stickers')} />}
      />
    );
  }
  if (loading || !ctx) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Carton Stickers" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const noLayout = !ctx.layout;
  const blockedByPermission = ctx.pl.status === PL_STATUS.DRAFT ? !canOverride : !canPrint;
  const reprintBlocked = printedOverlap.length > 0 && !canReprint;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`Stickers — ${ctx.pl.plNo}`}
        subtitle={`${ctx.pl.buyerName} · ${num(ctx.pl.totals.cartons)} cartons · ${ctx.layout ? ctx.layout.name : 'no layout'}`}
        onBack={() => navigate('/export-docs/stickers')}
        status={ctx.pl.status === PL_STATUS.DRAFT ? <Tag color="gold">Draft packing list</Tag> : <Tag color="green">{ctx.pl.status}</Tag>}
        style={STICKY_HEADER}
      >
        <Tooltip title={
          noLayout ? 'No sticker layout is configured for this buyer.'
            : blockedByPermission ? 'You do not hold the right to print these labels.'
              : reprintBlocked ? 'These cartons were printed already and you do not hold the reprint right.'
                : check?.blockedReason || undefined
        }
        >
          <span>
            <ActionButton
              action="print"
              text="Generate & print"
              loading={busy}
              disabled={noLayout || blockedByPermission || reprintBlocked || !check?.canGenerate}
              onClick={handleGenerate}
            />
          </span>
        </Tooltip>
      </PageHeader>

      {noLayout && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          title="No sticker layout configured for this buyer"
          description="Configure a sticker template for this buyer and sub-client before generating labels."
        />
      )}

      {check?.blocked?.length > 0 && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          title={`${check.blocked.length} carton(s) cannot be printed`}
          description={(
            <Space orientation="vertical" size={2}>
              <Text>
                {`Cartons ${check.blocked.slice(0, 12).map((b) => b.cartonNo).join(', ')}${check.blocked.length > 12 ? ' …' : ''} are missing a field this layout prints (${[...new Set(check.blocked.flatMap((b) => b.missing))].join(', ')}).`}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Fix them in the packing entry and refresh the packing list — a label with a blank weight is worse than no label.
              </Text>
            </Space>
          )}
        />
      )}

      {check?.reprintNeeded?.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          title="Some printed cartons have changed since they were labelled"
          description={`Cartons ${check.reprintNeeded.map((r) => (r.from === r.to ? r.from : `${r.from}–${r.to}`)).join(', ')} carry a printed field that has since changed. Reprint them.`}
        />
      )}

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard title="Cartons selected" value={num(ctx.selectedCount)} color="var(--primary-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Labels" value={num(spec?.labels)} color="var(--info-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Sheets" value={num(spec?.sheets)} color="var(--accent-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Already printed" value={ctx.printedLabel || '—'} color="var(--secondary-color)" /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <Card title="What to print" size="small">
            <Space orientation="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Scope</Text>
                <Segmented
                  block
                  options={[SCOPE.ALL, SCOPE.RANGE]}
                  value={scopeMode}
                  onChange={(v) => { setScopeMode(v); setSheetIndex(0); }}
                />
                {scopeMode === SCOPE.RANGE && (
                  <Space style={{ marginTop: 8 }}>
                    <InputNumber {...integerInputProps} min={1} placeholder="From" value={from} onChange={setFrom} />
                    <Text type="secondary">to</Text>
                    <InputNumber {...integerInputProps} min={1} placeholder="To" value={to} onChange={setTo} />
                  </Space>
                )}
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                  {`Reprinting a range does not regenerate the rest. Cartons available: ${ctx.pl.cartonRangeLabel}.`}
                </Text>
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Paper</Text>
                <FormSelect
                  variant="default"
                  allowClear={false}
                  style={{ width: '100%' }}
                  options={PAPER_LIST}
                  value={paper}
                  onChange={(v) => { setPaper(v); setSheetIndex(0); }}
                />
                {paper === 'THERMAL_4X6' && (
                  <Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    Set the printer to 4×6 / Actual size / no margins — browsers other than Chrome and Edge ignore the page size.
                  </Text>
                )}
              </div>

              {ctx.layout?.stickerLayout?.faces?.length > 1 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 6 }}>Faces</Text>
                  <Checkbox.Group
                    options={ctx.layout.stickerLayout.faces.map((f) => ({ label: f.title || f.key, value: f.key }))}
                    value={faceKeys}
                    onChange={(v) => { setFaceKeys(v); setSheetIndex(0); }}
                  />
                </div>
              )}

              {ctx.layout?.stickerLayout?.faces?.some((f) => f.barcode) && (
                <div>
                  <Space>
                    <Switch checked={barcodeOn} onChange={setBarcodeOn} />
                    <Text>Print barcode</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    EAN-13 and Code 128 render as vectors. QR is generated server-side in the API phase.
                  </Text>
                </div>
              )}

              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Carton print history</Text>
                <Space>
                  <InputNumber
                    {...integerInputProps} min={1} placeholder="Carton no"
                    onChange={(v) => {
                      if (!v) { setHistory(null); return; }
                      cartonPrintHistory(plId, v).then(setHistory).catch(() => setHistory(null));
                    }}
                  />
                  {history && (
                    <Text type="secondary">
                      {history.timesPrinted
                        ? `printed ${history.timesPrinted}×: ${history.events.map((e) => `${e.runNo} (${e.at})`).join(', ')}`
                        : 'never printed'}
                    </Text>
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            size="small"
            title={`Preview — cartons ${pageCartons.length ? formatRanges(pageCartons.map((c) => ({ from: c.cartonNo, to: c.cartonNo }))) : '—'}${sheetsPerPage > 1 ? ` (${sheetsPerPage} sheets)` : ''}`}
            extra={(
              <Space size={8}>
                <Space.Compact size="small">
                  <Tooltip title="Zoom out">
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      disabled={sheetPx.scale <= 0.25}
                      onClick={() => setZoom(Math.max(0.25, Number((sheetPx.scale - 0.25).toFixed(2))))}
                    />
                  </Tooltip>
                  <Tooltip title={zoom === null ? 'Fitted to the pane' : 'Back to fit'}>
                    <Button size="small" onClick={() => setZoom(null)}>
                      {`${Math.round(sheetPx.scale * 100)}%`}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Zoom in">
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      disabled={sheetPx.scale >= 4}
                      onClick={() => setZoom(Math.min(4, Number((sheetPx.scale + 0.25).toFixed(2))))}
                    />
                  </Tooltip>
                </Space.Compact>
                {pageCount > 1 && (
                  <Pagination
                    simple
                    size="small"
                    current={sheetIndex + 1}
                    total={pageCount}
                    pageSize={1}
                    onChange={(p) => setSheetIndex(p - 1)}
                  />
                )}
              </Space>
            )}
            styles={{ body: { padding: 12, background: '#7a7a7a', minHeight: PREVIEW_H } }}
          >
            {/* `margin: auto` on the child rather than `justify-content: center`:
                a flex-centred child wider than its container has its left overflow
                clipped and unreachable, which is exactly what zooming in produces. */}
            <div ref={paneRef} style={{ height: PREVIEW_H, overflow: 'auto' }}>
              {previewHtml ? (
                <div style={{
                  width: sheetPx.w * sheetPx.scale,
                  height: sheetPx.h * sheetPx.scale,
                  margin: '0 auto',
                }}
                >
                  <iframe
                    title="Sticker sheet preview"
                    srcDoc={previewHtml}
                    scrolling="no"
                    style={{
                      border: 0,
                      width: sheetPx.w,
                      height: sheetPx.h,
                      background: '#fff',
                      transform: `scale(${sheetPx.scale})`,
                      transformOrigin: 'top left',
                    }}
                  />
                </div>
              ) : (
                <div style={{ padding: 24, color: '#fff' }}>
                  {noLayout ? 'No layout to preview.' : 'Nothing in the selected range.'}
                </div>
              )}
            </div>
          </Card>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {`One page of ${num(cartonsPerPage)} carton(s) is rendered at a time, so a shipment of any size previews instantly. Printing builds all ${num(spec?.sheets)} sheet(s) in one document.`}
          </Text>
        </Col>
      </Row>

      <AckReasonModal
        key={reasonCfg?.key || 'none'}
        open={Boolean(reasonCfg)}
        title={reasonCfg?.title}
        label={reasonCfg?.label}
        context={reasonCfg?.context}
        okText={reasonCfg?.okText}
        danger={reasonCfg?.danger}
        confirming={busy}
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

export default StickerWorkspace;
