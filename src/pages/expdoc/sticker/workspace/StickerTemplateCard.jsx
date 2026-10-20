import { Alert, Card, Space, Tag, Typography } from 'antd';
import { FormSelect } from '../../../../components/form';
import { layoutCount, revisedSinceLastRun } from './stickerWorkspaceModel';

const { Text } = Typography;

/** Whose layout it is: the built-in standard, the buyer's own, or one for every buyer. */
const ownerTag = (layout) => {
  if (layout.isSystem) return <Tag>Standard</Tag>;
  if (layout.buyerId != null || layout.buyerName) return <Tag color="blue">Buyer&apos;s own</Tag>;
  return <Tag color="purple">For every buyer</Tag>;
};

/**
 * Which layout prints: the choice when the buyer has several, the layout in use and whose
 * it is, a notice when the standard marking prints because the buyer has none of their
 * own, and a note when the layout was revised since this packing list last printed.
 */
const StickerTemplateCard = ({ ctx, reloading, onPick }) => {
  const { layout } = ctx;
  const options = ctx.layoutOptions || [];
  const revised = revisedSinceLastRun(ctx.runs, layout);
  // Chosen over the buyer's own, the standard marking needs no notice — only its tag.
  const fallback = Boolean(layout?.isSystem) && layoutCount(options) === 0;

  return (
    <Card title="Sticker layout" size="small" style={{ marginBottom: 16 }}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        {options.length > 1 && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              <label htmlFor="sticker-layout">Layout</label>
            </Text>
            <FormSelect
              variant="default"
              allowClear={false}
              id="sticker-layout"
              style={{ width: '100%' }}
              options={options}
              value={layout?.id}
              loading={reloading}
              placeholder="Pick a sticker layout"
              onChange={onPick}
            />
          </div>
        )}

        {layout ? (
          <div>
            <Space size={8} wrap>
              <Text strong>{`${layout.name} v${layout.version}`}</Text>
              {ownerTag(layout)}
            </Space>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{layout.templateCode}</Text>
          </div>
        ) : (
          <Text type="secondary">No layout chosen yet.</Text>
        )}

        {fallback && (
          <Alert
            type="info" showIcon
            title={`No carton-sticker template for ${ctx.pl.buyerName} yet`}
            description="The standard export carton marking prints. Add the buyer's own under Buyer templates — upload their sticker as PDF, Excel or Word — and the next run offers it."
          />
        )}

        {revised && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`Revised since the last run: ${revised.runNo} printed with v${revised.from}; this run prints with v${revised.to}.`}
          </Text>
        )}
      </Space>
    </Card>
  );
};

export default StickerTemplateCard;
