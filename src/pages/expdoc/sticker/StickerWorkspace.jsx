import { useMemo, useState } from 'react';
import { Col, Result, Row, Skeleton, Tag, Tooltip } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE, PL_STATUS } from '../../../utils/expDocConstants';
import { intersectRanges } from '../../../utils/expDocCalc';
import AckReasonModal from '../shared/AckReasonModal';
import useExporterBlock from '../shared/useExporterBlock';
import { SCOPE, generateBlockReason, num } from './workspace/stickerWorkspaceModel';
import useStickerContext from './workspace/useStickerContext';
import useStickerCheck from './workspace/useStickerCheck';
import useLayoutSettings from './workspace/useLayoutSettings';
import useAskAnswers from './workspace/useAskAnswers';
import useStickerPreview from './workspace/useStickerPreview';
import useStickerGenerate from './workspace/useStickerGenerate';
import StickerAlerts from './workspace/StickerAlerts';
import StickerStats from './workspace/StickerStats';
import StickerTemplateCard from './workspace/StickerTemplateCard';
import StickerAskValues from './workspace/StickerAskValues';
import StickerPrintControls from './workspace/StickerPrintControls';
import StickerPreviewPane from './workspace/StickerPreviewPane';
import StickerRunHistory from './workspace/StickerRunHistory';

const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };
const CONSOLE = '/export-docs/stickers';

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
  const exporter = useExporterBlock();
  const [range, setRange] = useState({ mode: SCOPE.ALL, from: null, to: null });
  // The layout picked; undefined lets the service choose (the family last printed, or the only one).
  const [templateId, setTemplateId] = useState();
  // Kept on the bounds that count: switching to Range before both are typed reloads nothing.
  const from = range.mode === SCOPE.RANGE && range.from && range.to ? range.from : null;
  const to = from ? range.to : null;
  const scope = useMemo(() => ({ ...(from ? { mode: 'RANGE', from, to } : { mode: 'ALL' }), group: range.group }), [from, to, range.group]);

  const { ctx, error, loading, reloading, reload, retry } = useStickerContext(plId, scope, templateId);
  const settings = useLayoutSettings(ctx);
  const ask = useAskAnswers(ctx);
  const { check, checking } = useStickerCheck(plId, { scope, ctx, printBarcodes: settings.printBarcodes, exporter });
  const preview = useStickerPreview(plId, { ctx, scope, settings, exporter, ask: ask.askValues });
  // A reprint is only a reprint if THIS selection was printed before — printing
  // cartons 61–80 after 1–60 is a first print, so it neither needs the reprint
  // right nor a reason.
  const printedOverlap = useMemo(() => intersectRanges(ctx?.selectedRanges || [], ctx?.printedRanges || []), [ctx]);
  const gen = useStickerGenerate({
    plId, ctx, scope, settings, exporter, askValues: ask.askValues, preview, check, printedOverlap, reload,
    onBatch: (from, to) => setRange((r) => ({ ...r, mode: SCOPE.RANGE, from, to })),
  });

  if (error) {
    return (
      <Result
        status="warning"
        title="Stickers could not be opened"
        subTitle={error}
        extra={[
          <ActionButton key="retry" action="refresh" text="Retry" onClick={retry} />,
          <ActionButton key="back" action="back" text="Back" onClick={() => navigate(CONSOLE)} />,
        ]}
      />
    );
  }
  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Carton Stickers" style={STICKY_HEADER} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  const { pl, layout } = ctx;
  const isDraft = pl.status === PL_STATUS.DRAFT;
  const blockReason = generateBlockReason({
    layout,
    mustPick: (ctx.layoutOptions || []).length > 1,
    blockedByPermission: !hasPermission(EXPDOC_MODULE.STICKERS, isDraft ? 'override' : 'print'),
    reprintBlocked: printedOverlap.length > 0 && !hasPermission(EXPDOC_MODULE.STICKERS, 'reprint'),
    unanswered: ask.unanswered,
    noFaces: preview.spec?.faces === 0,
    checking: checking || reloading, // what is on screen must be what prints
    check,
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={`Stickers — ${pl.plNo}`}
        subtitle={`${pl.buyerName} · ${num(pl.totals.cartons)} cartons · ${layout ? layout.name : 'layout not chosen'}`}
        onBack={() => navigate(CONSOLE)}
        status={isDraft ? <Tag color="gold">Draft packing list</Tag> : <Tag color="green">{pl.status}</Tag>}
        style={STICKY_HEADER}
      >
        <Tooltip title={blockReason || undefined}>
          <span>
            <ActionButton
              action="print" text="Generate & print" loading={gen.busy} disabled={Boolean(blockReason)} onClick={gen.start}
            />
          </span>
        </Tooltip>
      </PageHeader>

      <StickerAlerts ctx={ctx} check={check} printBarcodes={settings.printBarcodes} />

      <StickerStats ctx={ctx} spec={preview.spec} />

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <StickerTemplateCard ctx={ctx} reloading={reloading} onPick={setTemplateId} />
          {ask.questions.length > 0 && (
            <StickerAskValues questions={ask.questions} answers={ask.answers} onChange={ask.setAnswer} />
          )}
          <StickerPrintControls ctx={ctx} range={range} onRange={setRange} settings={settings} />
        </Col>
        <Col xs={24} lg={15}>
          <StickerPreviewPane preview={preview} paper={settings.paper} hasLayout={Boolean(layout)} reloading={reloading} />
        </Col>
      </Row>

      <StickerRunHistory plId={plId} runs={ctx.runs} group={ctx.printGroup} />

      <AckReasonModal
        key={gen.reason?.key || 'none'}
        open={Boolean(gen.reason)}
        title={gen.reason?.title}
        label={gen.reason?.label}
        context={gen.reason?.context}
        okText={gen.reason?.okText}
        danger={gen.reason?.danger}
        confirming={gen.busy}
        onCancel={gen.cancelReason}
        onSubmit={gen.submitReason}
      />
    </div>
  );
};

export default StickerWorkspace;
