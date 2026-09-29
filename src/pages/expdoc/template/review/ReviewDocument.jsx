import {
  Alert, Button, Card, Flex, Input, Space, Tooltip, Typography,
} from 'antd';
import { EditOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { DOC_TYPE_LABELS } from '../../../../utils/expDocConstants';
import TemplatePrintPreview from '../TemplatePrintPreview';
import AttentionList from './AttentionList';
import { whatWasRead } from './attentionModel';

const { Text } = Typography;

/**
 * One document read from the upload, top to bottom in the order the user works: what
 * it is called, what needs them, then how it will print. "Edit layout in detail" sits
 * with the preview (and in the page's sticky header), so a change and its effect are
 * never a scroll apart.
 *
 * Leaving a document out only makes sense when the file held more than one — with a
 * single document the page's Discard does that — so the choice appears only then.
 */
const ReviewDocument = ({
  draft, docCount, items, notes, exporter, onPatch, onInclude, onBind, onRemove, onDismiss, onAddLeftOver,
  onShowInFile, onOpenEditor,
}) => {
  const t = draft.template;
  const docLabel = (DOC_TYPE_LABELS[t.docType] || t.docType).toLowerCase();
  const canLeaveOut = docCount > 1;

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small">
        <Flex gap={16} wrap align="flex-end">
          <div style={{ flex: '1 1 320px' }}>
            <Text type="secondary">Template name</Text>
            <Input
              name="templateName" aria-label={`Name of the ${docLabel} template`}
              value={t.name || ''} placeholder="What staff pick it by, e.g. Packing list — sea"
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>
          {canLeaveOut && draft.include && (
            <Tooltip title={`Your file held ${docCount} documents. Leave this ${docLabel} out and save only the others.`}>
              <Button type="text" icon={<MinusCircleOutlined />} onClick={() => onInclude(false)}>
                {`Don't create this ${docLabel} template`}
              </Button>
            </Tooltip>
          )}
        </Flex>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
          {[draft.where && `Read from ${draft.where}`, whatWasRead(t), t.templateCode && `code ${t.templateCode}`]
            .filter(Boolean).join(' · ')}
        </Text>
        {!draft.include && (
          <Alert
            type="warning" showIcon style={{ marginTop: 8 }}
            title={`This ${docLabel} template will not be created`}
            description="The others from your file are saved without it."
            action={<Button size="small" onClick={() => onInclude(true)}>Create it after all</Button>}
          />
        )}
      </Card>

      <AttentionList
        items={items}
        docType={t.docType}
        onBind={onBind}
        onRemove={onRemove}
        onDismiss={onDismiss}
        onAddLeftOver={onAddLeftOver}
        onShowInFile={onShowInFile}
        onOpenEditor={onOpenEditor}
      />

      {notes.length > 0 && (
        <Alert
          type="info" showIcon title="Good to know"
          description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        />
      )}

      <TemplatePrintPreview
        key={draft.uid}
        template={t}
        exporter={exporter}
        extra={(
          <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => onOpenEditor(null)}>
            Edit layout in detail
          </Button>
        )}
      />
    </Space>
  );
};

export default ReviewDocument;
