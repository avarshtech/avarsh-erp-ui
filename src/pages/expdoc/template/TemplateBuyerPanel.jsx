import { useMemo } from 'react';
import {
  Button, Card, Empty, Space, Typography,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import { DOC_TYPE, DOC_TYPE_LABELS } from '../../../utils/expDocConstants';
import { familiesOf } from './registerModel';
import TemplateFamilyCard from './TemplateFamilyCard';

const { Title, Text } = Typography;

const SECTIONS = [DOC_TYPE.PACKING_LIST, DOC_TYPE.INVOICE, DOC_TYPE.STICKER];

/**
 * One buyer's templates, by document. A buyer may keep several packing-list, invoice
 * and sticker templates (sea / air, say); staff pick one per document or sticker run.
 */
const TemplateBuyerPanel = ({
  group, highlightIds, canAdd, canDelete, onUpload, onNew, onOpen, onPreview, onCopy, onDelete,
}) => {
  const families = useMemo(() => familiesOf(group?.templates), [group]);

  if (!group) {
    return <Card><Empty description="Pick a buyer on the left to see their templates." /></Card>;
  }

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>{group.title}</Title>
          <Text type="secondary">
            {group.standard
              ? 'Layouts any buyer may use, and the built-in standard set documents fall back to.'
              : 'Packing-list, invoice and carton-sticker layouts for this buyer. Several of each are allowed.'}
          </Text>
        </div>
        <Space wrap>
          {canAdd && (
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => onUpload(group)}>
              Upload buyer document
            </Button>
          )}
          {canAdd && <Button icon={<PlusOutlined />} onClick={() => onNew(group)}>New template</Button>}
        </Space>
      </Space>

      {SECTIONS.map((docType) => {
        const list = families.filter((f) => f.docType === docType);
        return (
          <div key={docType} style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {`${DOC_TYPE_LABELS[docType]}${list.length ? ` (${list.length})` : ''}`}
            </Text>
            {list.length ? list.map((family) => (
              <TemplateFamilyCard
                key={family.key}
                family={family}
                highlighted={family.revisions.some((r) => highlightIds.includes(String(r.id)))}
                canAdd={canAdd}
                canDelete={canDelete}
                onOpen={onOpen}
                onPreview={onPreview}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            )) : (
              <Card size="small" style={{ borderStyle: 'dashed' }}>
                <Space orientation="vertical" size={4}>
                  <Text type="secondary">
                    {`No ${DOC_TYPE_LABELS[docType].toLowerCase()} template yet — documents use the standard layout.`}
                  </Text>
                  {canAdd && (
                    <Button size="small" type="link" style={{ paddingInline: 0 }} onClick={() => onUpload(group, docType)}>
                      {`Upload the buyer's ${DOC_TYPE_LABELS[docType].toLowerCase()}`}
                    </Button>
                  )}
                </Space>
              </Card>
            )}
          </div>
        );
      })}
    </Card>
  );
};

export default TemplateBuyerPanel;
