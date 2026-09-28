import { Button, Empty, Input, InputNumber, Space, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { integerInputProps } from '../../../../utils/inputHelpers';
import FieldBindingPicker from '../FieldBindingPicker';
import { listEditor, withRowKeys, newRowKey, evidenceColumn } from './editorKit';
import { RowTools } from './EditorParts';

const { Text } = Typography;

const COLUMN_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'SIZE_GRID', label: 'Size grid (one column per size)' },
];

const TOTALS = [
  { value: 'SUM', label: 'Sum' },
  { value: 'SUM_EXPANDED', label: 'Sum × cartons' },
];

const SIZE_VALUES = [
  { value: 'PER_CARTON', label: 'Pieces per carton' },
  { value: 'RATIO', label: 'Assortment ratio' },
];

/**
 * One ordered set of table columns: the packing list's carton grid, a sheet's own
 * column set (solid packs vs ratio packs), or the invoice's goods columns.
 *
 * `group` is the header cell a buyer's layout spans over several columns ("units" over
 * the sizes, "measurement (cm)" over L B H) — adjacent columns with the same group
 * print under one spanning header.
 */
const ColumnsEditor = ({
  columns, onChange, locked, categories, allowSizeGrid = true, meta, metaList, onEvidence,
  emptyText = 'No columns configured.', addLabel = 'Add column', namePrefix = 'col',
}) => {
  const cols = listEditor(columns, onChange);
  const list = columns || [];

  return (
    <>
      <Table
        size="small"
        rowKey="__row"
        pagination={false}
        scroll={{ x: 1180 }}
        dataSource={withRowKeys(list)}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
        columns={[
          { title: '#', width: 44, align: 'center', render: (_, r) => r.__row + 1 },
          {
            title: 'Label',
            width: 170,
            render: (_, r) => (
              <Input size="small" name={`${namePrefix}-label-${r.__row}`} value={r.label || ''} disabled={locked}
                onChange={(e) => cols.set(r.__row, { label: e.target.value })} />
            ),
          },
          {
            title: 'Group header',
            width: 150,
            render: (_, r) => (
              <Input size="small" name={`${namePrefix}-group-${r.__row}`} value={r.group || ''} disabled={locked}
                placeholder="none" onChange={(e) => cols.set(r.__row, { group: e.target.value || undefined })} />
            ),
          },
          {
            title: 'Type',
            width: 170,
            render: (_, r) => (
              <FormSelect
                variant="default" allowClear={false} size="small" style={{ width: '100%' }} disabled={locked}
                value={r.type || 'TEXT'}
                onChange={(v) => cols.set(r.__row, v === 'SIZE_GRID'
                  ? { type: v, binding: 'row.sizeQty', align: 'right' }
                  : { type: v, align: v === 'NUMBER' ? 'right' : r.align })}
                options={allowSizeGrid ? COLUMN_TYPES : COLUMN_TYPES.filter((t) => t.value !== 'SIZE_GRID')}
              />
            ),
          },
          {
            title: 'Bound to',
            render: (_, r) => (r.type === 'SIZE_GRID'
              ? (
                <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>One column per size, from the document&apos;s size set</Text>
                  <FormSelect
                    variant="default" allowClear={false} size="small" style={{ width: '100%' }} disabled={locked}
                    value={r.sizeValue || 'PER_CARTON'}
                    onChange={(v) => cols.set(r.__row, { sizeValue: v === 'RATIO' ? 'RATIO' : undefined })}
                    options={SIZE_VALUES}
                  />
                </Space>
              )
              : (
                <FieldBindingPicker
                  value={r.binding} disabled={locked} categories={categories}
                  onChange={(b) => cols.set(r.__row, { binding: b })}
                />
              )),
          },
          {
            title: 'Total',
            width: 130,
            render: (_, r) => (
              <FormSelect
                variant="default" size="small" style={{ width: '100%' }} disabled={locked}
                value={r.total || undefined} placeholder="none"
                onChange={(v) => cols.set(r.__row, { total: v || undefined })} options={TOTALS}
              />
            ),
          },
          {
            title: 'Width',
            width: 84,
            render: (_, r) => (
              <InputNumber {...integerInputProps} size="small" min={30} style={{ width: '100%' }} disabled={locked}
                name={`${namePrefix}-width-${r.__row}`} value={r.width} onChange={(v) => cols.set(r.__row, { width: v })} />
            ),
          },
          ...evidenceColumn(meta, metaList, onEvidence),
          {
            title: '',
            width: 110,
            render: (_, r) => <RowTools index={r.__row} count={list.length} list={cols} disabled={locked} />,
          },
        ]}
      />
      {!locked && (
        <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }}
          onClick={() => cols.add({ key: newRowKey('c'), label: '', binding: undefined, type: 'TEXT', align: 'left', width: 100 })}>
          {addLabel}
        </Button>
      )}
    </>
  );
};

export default ColumnsEditor;
