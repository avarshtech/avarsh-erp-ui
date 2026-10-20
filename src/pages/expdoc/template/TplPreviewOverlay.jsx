import { useMemo, useState } from 'react';
import {
  Alert, Modal, Segmented, Space, Tag, Typography,
} from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import {
  PREVIEW_MODE, PREVIEW_MODES, buildTemplatePreviewHtml, previewPageWidthPx,
} from './templatePreviewHtml';
import PrintPageFrame from './PrintPageFrame';

const { Text } = Typography;

/** A darkened, blurred screen behind the page in either theme — so the caption is always white. */
const OVERLAY_STYLES = {
  mask: {
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  container: { padding: 0, background: 'transparent', boxShadow: 'none' },
  header: { background: 'transparent', padding: '0 44px 10px 0', margin: 0 },
  body: { padding: 0 },
};

/**
 * The document alone, at full size, over the blurred screen — the way an image opens,
 * not in a side panel. The page shows at its real width and full height; the screen
 * scrolls down it. Esc, the close button or a click on the background closes it. It
 * shows sample values or the template alone: the caller's choice when it passes
 * `templateOnly` and `onModeChange`, else its own. The global modal styles are undone
 * for it in overrides.css (`.tpl-preview-overlay`). The HTML comes from the same
 * builders the real documents use (templatePreviewHtml).
 */
const TplPreviewOverlay = ({
  open, sample, exporter, onClose, templateOnly: shownTemplateOnly, onModeChange,
}) => {
  const [ownTemplateOnly, setOwnTemplateOnly] = useState(false);
  const controlled = typeof onModeChange === 'function';
  const templateOnly = controlled ? Boolean(shownTemplateOnly) : ownTemplateOnly;
  const setTemplateOnly = controlled ? onModeChange : setOwnTemplateOnly;
  const html = useMemo(() => buildTemplatePreviewHtml(sample, exporter, { templateOnly }), [sample, exporter, templateOnly]);
  const tpl = sample?.template;
  const pageWidthPx = previewPageWidthPx(tpl);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      className="tpl-preview-overlay"
      footer={null}
      width={pageWidthPx ? pageWidthPx + 8 : '94vw'}
      style={{ top: 24, paddingBottom: 24 }}
      zIndex={1200}
      mask={{ blur: true }}
      destroyOnHidden
      closeIcon={<CloseOutlined aria-label="Close preview" style={{ color: '#fff', fontSize: 20 }} />}
      styles={OVERLAY_STYLES}
      title={(
        <Space size={10} wrap>
          <Text strong style={{ color: '#fff', fontSize: 15 }}>{tpl?.name || tpl?.templateCode || 'Template'}</Text>
          {tpl?.version != null && <Tag style={{ marginInlineEnd: 0 }}>{`v${tpl.version}`}</Tag>}
          <Segmented
            size="small"
            options={PREVIEW_MODES}
            value={templateOnly ? PREVIEW_MODE.TEMPLATE : PREVIEW_MODE.VALUES}
            onChange={(v) => setTemplateOnly(v === PREVIEW_MODE.TEMPLATE)}
            aria-label="What the preview shows"
          />
        </Space>
      )}
    >
      {html ? (
        <PrintPageFrame
          key={pageWidthPx}
          html={html}
          title="Template preview"
          pageWidthPx={pageWidthPx}
          frameStyle={{ boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)' }}
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Nothing to preview yet"
          description={sample?.empty
            ? 'There is no packing data seeded to preview against.'
            : 'This template has no printable content yet — add a face, a column set, or a line grain.'}
        />
      )}
    </Modal>
  );
};

export default TplPreviewOverlay;
