import {
  Alert, Button, Card, Empty, Input, Table,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { TEXT_PLACEMENT_LABELS } from '../../../../utils/expDocConstants';
import { listEditor, withRowKeys, newRowKey, evidenceColumn } from './editorKit';
import { RowTools } from './EditorParts';

const { TextArea } = Input;
const PLACEMENTS = Object.entries(TEXT_PLACEMENT_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Fixed sentences the buyer's document prints on every copy — "SUPPLY MEANT FOR EXPORT
 * WITH PAYMENT OF IGST", a scheme claim, a handling note — and where they print.
 */
const TabTextBlocks = ({ tpl, patch, locked, meta, onEvidence }) => {
  const blocks = listEditor(tpl.textBlocks, (v) => patch({ textBlocks: v }));
  const rows = tpl.textBlocks || [];
  return (
    <Card
      size="small"
      title="Fixed text"
      extra={!locked && (
        <Button size="small" icon={<PlusOutlined />}
          onClick={() => blocks.add({ key: newRowKey('t'), title: '', text: '', placement: 'AFTER_TABLE' })}>
          Add text
        </Button>
      )}
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Printed verbatim"
        description="Text here prints exactly as written on every document made from this template. Values that change per document belong in header fields instead." />
      <Table
        size="small"
        rowKey="__row"
        pagination={false}
        scroll={{ x: 820 }}
        dataSource={withRowKeys(rows)}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fixed text." /> }}
        columns={[
          {
            title: 'Heading',
            width: 180,
            render: (_, r) => (
              <Input size="small" name={`tb-title-${r.__row}`} value={r.title || ''} placeholder="optional" disabled={locked}
                onChange={(e) => blocks.set(r.__row, { title: e.target.value })} />
            ),
          },
          {
            title: 'Text',
            render: (_, r) => (
              <TextArea size="small" rows={2} name={`tb-text-${r.__row}`} value={r.text || ''} disabled={locked}
                onChange={(e) => blocks.set(r.__row, { text: e.target.value })} />
            ),
          },
          {
            title: 'Prints',
            width: 180,
            render: (_, r) => (
              <FormSelect variant="default" allowClear={false} size="small" style={{ width: '100%' }} disabled={locked}
                value={r.placement || 'AFTER_TABLE'} onChange={(v) => blocks.set(r.__row, { placement: v })} options={PLACEMENTS} />
            ),
          },
          ...evidenceColumn(meta, 'textBlocks', onEvidence),
          { title: '', width: 110, render: (_, r) => <RowTools index={r.__row} count={rows.length} list={blocks} disabled={locked} /> },
        ]}
      />
    </Card>
  );
};

export default TabTextBlocks;
