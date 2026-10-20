import {
  Button, Card, Checkbox, Empty, Input, Space, Table, Tooltip,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { DOC_TYPE } from '../../../../utils/expDocConstants';
import FieldBindingPicker from '../FieldBindingPicker';
import InvoiceBoxesCard from './InvoiceBoxesCard';
import { listEditor, withRowKeys, newRowKey, evidenceColumn } from './editorKit';
import { RowTools } from './EditorParts';

/**
 * Header fields and party blocks. An invoice keeps the standard header grid (edited
 * box by box) and adds its own fields under it; a packing list is built from fields
 * and address blocks alone.
 */
const TabHeader = ({ tpl, patch, locked, meta, onEvidence }) => {
  const isInvoice = tpl.docType === DOC_TYPE.INVOICE;
  const fields = listEditor(tpl.headerFields, (v) => patch({ headerFields: v }));
  const blocks = listEditor(tpl.addressBlocks, (v) => patch({ addressBlocks: v }));
  const fieldRows = tpl.headerFields || [];
  const blockRows = tpl.addressBlocks || [];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {isInvoice && <InvoiceBoxesCard tpl={tpl} patch={patch} locked={locked} meta={meta} onEvidence={onEvidence} />}

      <Card
        size="small"
        title={isInvoice ? 'Extra header fields' : 'Header fields'}
        extra={!locked && (
          <Button size="small" icon={<PlusOutlined />}
            onClick={() => fields.add({ key: newRowKey('f'), label: '', binding: undefined, mandatory: false })}>
            Add field
          </Button>
        )}
      >
        <Table
          size="small"
          rowKey="__row"
          pagination={false}
          scroll={{ x: 820 }}
          dataSource={withRowKeys(fieldRows)}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isInvoice
            ? 'No fields beyond the standard header boxes.'
            : 'No header fields. The document prints its title and address blocks only.'} /> }}
          columns={[
            {
              title: 'Label',
              width: 220,
              render: (_, r) => (
                <Input size="small" name={`hf-label-${r.__row}`} value={r.label || ''} disabled={locked}
                  onChange={(e) => fields.set(r.__row, { label: e.target.value })} />
              ),
            },
            {
              title: 'Bound to',
              render: (_, r) => (
                <FieldBindingPicker value={r.binding} disabled={locked} onChange={(b) => fields.set(r.__row, { binding: b })} />
              ),
            },
            {
              title: 'Mandatory',
              width: 100,
              align: 'center',
              render: (_, r) => (
                <Tooltip title="A mandatory field that is empty blocks submission (V-12).">
                  <Checkbox name={`hf-mandatory-${r.__row}`} checked={Boolean(r.mandatory)} disabled={locked}
                    onChange={(e) => fields.set(r.__row, { mandatory: e.target.checked })} />
                </Tooltip>
              ),
            },
            ...evidenceColumn(meta, 'headerFields', onEvidence),
            { title: '', width: 110, render: (_, r) => <RowTools index={r.__row} count={fieldRows.length} list={fields} disabled={locked} /> },
          ]}
        />
      </Card>

      {!isInvoice && (
        <Card
          size="small"
          title="Address blocks"
          extra={!locked && (
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => blocks.add({ key: newRowKey('b'), label: '', binding: undefined })}>
              Add block
            </Button>
          )}
        >
          <Table
            size="small"
            rowKey="__row"
            pagination={false}
            scroll={{ x: 720 }}
            dataSource={withRowKeys(blockRows)}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No address blocks configured." /> }}
            columns={[
              {
                title: 'Label',
                width: 220,
                render: (_, r) => (
                  <Input size="small" name={`ab-label-${r.__row}`} value={r.label || ''} disabled={locked}
                    onChange={(e) => blocks.set(r.__row, { label: e.target.value })} />
                ),
              },
              {
                title: 'Bound to',
                render: (_, r) => (
                  <FieldBindingPicker value={r.binding} disabled={locked}
                    categories={['EXPORTER', 'BUYER', 'INVOICE', 'SHIPMENT', 'PL']}
                    onChange={(b) => blocks.set(r.__row, { binding: b })} />
                ),
              },
              ...evidenceColumn(meta, 'addressBlocks', onEvidence),
              { title: '', width: 110, render: (_, r) => <RowTools index={r.__row} count={blockRows.length} list={blocks} disabled={locked} /> },
            ]}
          />
        </Card>
      )}
    </Space>
  );
};

export default TabHeader;
