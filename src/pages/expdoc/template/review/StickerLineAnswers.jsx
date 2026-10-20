import { Button, Space, Tooltip } from 'antd';
import { ASK_WHEN_PRINTING } from './stickerReviewModel';

/**
 * The two quick answers a carton-sticker line with nothing to fill it has, beside choosing
 * ERP data: ask for the value once per print run — a batch or customer order number that
 * changes with every order — or leave the space blank to be written in by hand, as the
 * buyer's own sticker often does. The answer's key is made when it is applied, from the
 * template as it then stands (bindStickerLinePatch); `item.askKey` only names it here.
 */
const StickerLineAnswers = ({ item, onBind, onDismiss }) => (
  <Space size={6} wrap>
    <Tooltip title={`Typed in once before each print run, and printed on every sticker of that run${item.askKey ? ` (kept as “${item.askKey}”)` : ''}.`}>
      <Button size="small" onClick={() => onBind(item, ASK_WHEN_PRINTING)}>Ask when printing</Button>
    </Tooltip>
    <Tooltip title="The space prints empty, to be written in by hand.">
      <Button size="small" onClick={() => onDismiss(item)}>Leave blank (hand-written)</Button>
    </Tooltip>
  </Space>
);

export default StickerLineAnswers;
