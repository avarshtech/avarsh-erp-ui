import { useState } from 'react';
import {
  Button, Card, Dropdown, Flex, Popover, Space, Tag, Typography, theme,
} from 'antd';
import {
  CheckCircleFilled, CloseCircleOutlined, DownOutlined, FileAddOutlined, FileSearchOutlined,
  QuestionCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { DOC_TYPE } from '../../../../utils/expDocConstants';
import FieldBindingPicker from '../FieldBindingPicker';
import { ATTENTION } from './attentionModel';
import { ADD_AS_LABEL, addChoicesFor } from './reviewModel';
import { STICKER_UNBOUND_HINT } from './stickerReviewModel';
import StickerLineAnswers from './StickerLineAnswers';

const { Text } = Typography;

const quote = (s) => `“${s}”`;
const FIXED = 'fixed:';

/**
 * Chooses what prints in a field. Nothing changes until "Apply" — typing fixed text
 * would otherwise resolve the item, and close this, after the first letter.
 */
const BindingChooser = ({ label, data, exclude, onApply, onCancel }) => {
  const [value, setValue] = useState();
  const fixed = typeof value === 'string' && value.startsWith(FIXED);
  const text = fixed ? value.slice(FIXED.length).trim() : '';
  const ready = fixed ? text !== '' : Boolean(value);
  return (
    <Space orientation="vertical" size={8} style={{ width: 340 }}>
      <Text strong>{`What should print for ${quote(label)}?`}</Text>
      <FieldBindingPicker value={value} onChange={setValue} categories={data} exclude={exclude} placeholder="Choose the ERP data" />
      <Space>
        <Button size="small" onClick={onCancel}>Cancel</Button>
        <Button size="small" type="primary" disabled={!ready} onClick={() => onApply(fixed ? `${FIXED}${text}` : value)}>
          Apply
        </Button>
      </Space>
    </Space>
  );
};

const ICON = {
  [ATTENTION.BLOCKER]: <Text type="danger"><CloseCircleOutlined /></Text>,
  [ATTENTION.NOT_FOUND]: <Text type="warning"><WarningOutlined /></Text>,
  [ATTENTION.UNBOUND]: <Text type="warning"><WarningOutlined /></Text>,
  [ATTENTION.UNSURE]: <Text type="secondary"><QuestionCircleOutlined /></Text>,
  [ATTENTION.LEFT_OVER]: <Text type="secondary"><FileAddOutlined /></Text>,
};

/** An item as the user reads it: what is wrong, then why it matters. */
const describe = (item, sticker) => {
  switch (item.kind) {
    case ATTENTION.BLOCKER:
      return { title: item.text, detail: 'Needed before this template can be saved.' };
    case ATTENTION.NOT_FOUND:
      return {
        title: item.fixedText
          ? `The text printed for ${quote(item.label)} is not in your file`
          : `${quote(item.label)} is not in your file`,
        detail: 'The reader added it, but your document does not show it. Remove it unless the buyer wants it.',
      };
    case ATTENTION.UNBOUND:
      return {
        title: `${quote(item.label)} — nothing fills it yet`,
        detail: [
          item.sample && `Your file shows ${quote(item.sample)} here.`,
          sticker ? STICKER_UNBOUND_HINT
            : 'Choose the data to print, or text that is the same on every document. Left like this, only the label prints.',
          item.suggested && `(The reader suggested ${quote(item.suggested)}, which the ERP does not have.)`,
        ].filter(Boolean).join(' '),
      };
    case ATTENTION.UNSURE:
      return {
        title: `Check ${quote(item.label)}`,
        detail: `The reader was not sure about this one${item.sample ? ` — your file shows ${quote(item.sample)}` : ''}. Compare it with the preview below.`,
      };
    default:
      return { title: quote(item.text), detail: 'This text is in your file but not in the template.' };
  }
};

/**
 * What one document needs from the user before it is saved, in plain words, each with
 * the one-click answers that settle it. An answered item leaves the list; `onDismiss`
 * takes the item, so the page can settle what else the answer covers.
 */
const AttentionList = ({
  items, docType, onBind, onRemove, onDismiss, onAddLeftOver, onShowInFile, onOpenEditor,
}) => {
  const { token } = theme.useToken();
  const [choosing, setChoosing] = useState(null);
  const leftOvers = items.filter((i) => i.kind === ATTENTION.LEFT_OVER);
  const addChoices = addChoicesFor(docType).map((c) => ({ key: c, label: ADD_AS_LABEL[c] }));
  const sticker = docType === DOC_TYPE.STICKER;

  const actionsFor = (item) => {
    const remove = item.removable && (
      <Button key="remove" size="small" danger onClick={() => onRemove(item)}>Remove</Button>
    );
    const buttons = {
      [ATTENTION.BLOCKER]: [
        <Button key="fix" size="small" type="primary" onClick={() => onOpenEditor(item.tab)}>Fix it</Button>,
      ],
      [ATTENTION.NOT_FOUND]: [
        remove,
        <Button key="keep" size="small" onClick={() => onDismiss(item)}>Keep it</Button>,
      ],
      [ATTENTION.UNBOUND]: [
        <Popover
          key="choose" trigger="click" placement="bottomLeft" destroyOnHidden
          open={choosing === item.key}
          onOpenChange={(open) => setChoosing(open ? item.key : null)}
          content={(
            <BindingChooser
              label={item.label} data={item.data} exclude={item.exclude}
              onCancel={() => setChoosing(null)}
              onApply={(binding) => { setChoosing(null); onBind(item, binding); }}
            />
          )}
        >
          <Button size="small" type="primary">Choose what fills it</Button>
        </Popover>,
        sticker
          ? <StickerLineAnswers key="sticker" item={item} onBind={onBind} onDismiss={onDismiss} />
          : <Button key="blank" size="small" onClick={() => onDismiss(item)}>Leave blank</Button>,
        remove,
      ],
      [ATTENTION.UNSURE]: [
        <Button key="ok" size="small" onClick={() => onDismiss(item)}>Looks right</Button>,
        remove,
      ],
      [ATTENTION.LEFT_OVER]: [
        <Dropdown key="add" trigger={['click']} menu={{ items: addChoices, onClick: ({ key }) => onAddLeftOver(item, key) }}>
          <Button size="small" type="primary">
            Add to template
            <DownOutlined />
          </Button>
        </Dropdown>,
        <Button key="ignore" size="small" onClick={() => onDismiss(item)}>Ignore</Button>,
      ],
    }[item.kind] || [];
    return [
      ...buttons,
      item.evidence && (
        <Button key="file" size="small" type="link" icon={<FileSearchOutlined />} onClick={() => onShowInFile(item.evidence)}>
          Show in file
        </Button>
      ),
    ].filter(Boolean);
  };

  return (
    <Card
      size="small"
      title={(
        <Space size={8}>
          <span>Needs your attention</span>
          {items.length > 0 && <Tag color="gold" style={{ marginInlineEnd: 0 }}>{`${items.length} left`}</Tag>}
        </Space>
      )}
      extra={leftOvers.length > 1 && (
        <Button size="small" type="link" onClick={() => leftOvers.forEach((i) => onDismiss(i))}>
          Ignore all unused text
        </Button>
      )}
    >
      {items.length === 0 ? (
        <Space size={8}>
          <Text type="success"><CheckCircleFilled /></Text>
          <Text>Nothing needs your attention. Check the preview below, then save.</Text>
        </Space>
      ) : (
        <div role="list" aria-label="Needs your attention">
          {items.map((item, i) => {
            const { title, detail } = describe(item, sticker);
            return (
              <div
                key={item.key}
                role="listitem"
                aria-label={title}
                style={{ padding: '10px 0', borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}
              >
                <Flex gap={10} align="flex-start">
                  <span style={{ fontSize: 16, lineHeight: '22px' }}>{ICON[item.kind]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ display: 'block' }}>{title}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{detail}</Text>
                    <Space size={6} wrap style={{ marginTop: 6 }}>{actionsFor(item)}</Space>
                  </div>
                </Flex>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default AttentionList;
