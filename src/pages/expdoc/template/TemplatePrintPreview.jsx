import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Segmented, Skeleton, Space, Typography,
} from 'antd';
import { ExpandOutlined } from '@ant-design/icons';
import { getTemplateSample } from '../../../services/expdoc/expDocService';
import {
  PREVIEW_MODE, PREVIEW_MODES, buildTemplatePreviewHtml, previewPageWidthPx, withTemplate,
} from './templatePreviewHtml';
import PrintPageFrame from './PrintPageFrame';
import ZoomPageFrame from './ZoomPageFrame';
import TplPreviewOverlay from './TplPreviewOverlay';

const { Text } = Typography;

/**
 * The template as it will print, inside the page — with sample values, or as the
 * template alone (labels, fixed text, the exporter and the buyer; the document's own
 * values hidden). The sample is loaded once per document type and buyer and then
 * dressed in the template on every edit, so the preview follows each change as it is
 * made. On a page it shows at its real width and full height (PrintPageFrame) — the
 * screen scrolls, not the preview; `zoomable` shows it in a window of `frameHeight`
 * instead, fitted whole and zoomed with the mouse wheel (ZoomPageFrame). "Bigger view"
 * opens it over the blurred screen, in the same mode. The parent keys it per document,
 * so switching documents never shows the last one's sample.
 */
const TemplatePrintPreview = ({
  template, exporter, extra, title = 'Preview', zoomable = false, frameHeight = '70vh',
}) => {
  const { docType, buyerName, buyerCode } = template;
  const [base, setBase] = useState(null);
  const [mode, setMode] = useState(PREVIEW_MODE.VALUES);
  const [bigger, setBigger] = useState(false);
  const templateOnly = mode === PREVIEW_MODE.TEMPLATE;

  useEffect(() => {
    let live = true;
    getTemplateSample({ docType, buyerName, buyerCode })
      .then((s) => { if (live) setBase(s); })
      .catch(() => { if (live) setBase({ empty: true }); });
    return () => { live = false; };
  }, [docType, buyerName, buyerCode]);

  const sample = useMemo(() => withTemplate(base, template), [base, template]);
  const html = useMemo(() => buildTemplatePreviewHtml(sample, exporter, { templateOnly }), [sample, exporter, templateOnly]);

  let body;
  if (!base) {
    body = <Skeleton active paragraph={{ rows: 8 }} />;
  } else if (html) {
    // Keyed by the page width: a frame only ever grows to fit its content, so a change of
    // paper or orientation starts a fresh one at the new width (and a fitted zoom).
    const pageWidthPx = previewPageWidthPx(template);
    body = zoomable ? (
      <ZoomPageFrame key={pageWidthPx} html={html} title="Print preview" pageWidthPx={pageWidthPx} height={frameHeight} />
    ) : (
      <div style={{ background: '#7a7a7a', padding: 12, borderRadius: 8 }}>
        <PrintPageFrame
          key={pageWidthPx}
          html={html}
          title="Print preview"
          pageWidthPx={pageWidthPx}
          frameStyle={{ boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)' }}
        />
      </div>
    );
  } else {
    body = (
      <Alert
        type="warning" showIcon title="Nothing to preview yet"
        description={base.empty
          ? 'There is no packing data to preview with yet. The template itself is not affected.'
          : 'This template has nothing printable yet — add a table column in "Edit layout in detail".'}
      />
    );
  }

  let hint = 'Filled with sample data from your packing records. Real documents print their own figures in this layout.';
  if (templateOnly) hint = 'The template alone: labels, fixed text, your company and the buyer. A document\'s own values are left blank.';
  if (zoomable) hint = `${hint} Scroll over the page to zoom, drag to move it.`;

  return (
    <>
      <Card
        size="small"
        title={title}
        extra={(
          <Space size={6} wrap>
            <Segmented size="small" options={PREVIEW_MODES} value={mode} onChange={setMode} aria-label="What the preview shows" />
            {extra}
            <Button size="small" icon={<ExpandOutlined />} disabled={!html} onClick={() => setBigger(true)}>Bigger view</Button>
          </Space>
        )}
      >
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>{hint}</Text>
        {body}
      </Card>
      <TplPreviewOverlay
        open={bigger}
        sample={sample}
        exporter={exporter}
        templateOnly={templateOnly}
        onModeChange={(only) => setMode(only ? PREVIEW_MODE.TEMPLATE : PREVIEW_MODE.VALUES)}
        onClose={() => setBigger(false)}
      />
    </>
  );
};

export default TemplatePrintPreview;
