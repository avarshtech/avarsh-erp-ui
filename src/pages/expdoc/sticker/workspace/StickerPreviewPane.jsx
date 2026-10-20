import {
  Button, Card, Pagination, Space, Spin, Tooltip, Typography,
} from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { formatRanges } from '../../../../utils/expDocCalc';
import { num } from './stickerWorkspaceModel';
import usePreviewPane, { PREVIEW_H } from './usePreviewPane';

const { Text } = Typography;
const step = (scale, by) => Math.min(4, Math.max(0.25, Number((scale + by).toFixed(2))));

/**
 * One page of the print document at true scale, fitted to the pane, with zoom and a
 * pager — what is checked here is what prints.
 */
const StickerPreviewPane = ({
  preview, paper, hasLayout, reloading,
}) => {
  const { paneRef, sheetPx, zoom, setZoom } = usePreviewPane(paper, preview.sheetsPerPage);
  const { cartons, html, sheetsPerPage, pageCount, pageIndex } = preview;
  const shown = cartons.length ? formatRanges(cartons.map((c) => ({ from: c.cartonNo, to: c.cartonNo }))) : '—';

  return (
    <>
      <Card
        size="small"
        title={`Preview — cartons ${shown}${sheetsPerPage > 1 ? ` (${sheetsPerPage} sheets)` : ''}`}
        extra={(
          <Space size={8}>
            {reloading && <Spin size="small" />}
            <Space.Compact size="small">
              <Tooltip title="Zoom out">
                <Button size="small" icon={<MinusOutlined />} disabled={sheetPx.scale <= 0.25} onClick={() => setZoom(step(sheetPx.scale, -0.25))} />
              </Tooltip>
              <Tooltip title={zoom === null ? 'Fitted to the pane' : 'Back to fit'}>
                <Button size="small" onClick={() => setZoom(null)}>{`${Math.round(sheetPx.scale * 100)}%`}</Button>
              </Tooltip>
              <Tooltip title="Zoom in">
                <Button size="small" icon={<PlusOutlined />} disabled={sheetPx.scale >= 4} onClick={() => setZoom(step(sheetPx.scale, 0.25))} />
              </Tooltip>
            </Space.Compact>
            {pageCount > 1 && (
              <Pagination
                simple size="small" current={pageIndex + 1} total={pageCount} pageSize={1}
                onChange={(p) => preview.setPage(p - 1)}
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
          {html ? (
            <div style={{ width: sheetPx.w * sheetPx.scale, height: sheetPx.h * sheetPx.scale, margin: '0 auto' }}>
              <iframe
                title="Sticker sheet preview"
                srcDoc={html}
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
              {hasLayout ? 'Nothing in the selected range.' : 'No layout to preview.'}
            </div>
          )}
        </div>
      </Card>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        {`One page of ${num(preview.cartonsPerPage)} carton(s) is rendered at a time, so a shipment of any size previews instantly. Printing builds all ${num(preview.spec?.sheets)} sheet(s) in one document.`}
      </Text>
    </>
  );
};

export default StickerPreviewPane;
