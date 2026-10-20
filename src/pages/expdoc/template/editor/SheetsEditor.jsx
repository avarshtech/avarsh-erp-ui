import {
  Alert, Button, Col, Empty, Input, Row, Space, Switch, Table, Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import {
  PACKING_TYPE, PACKING_TYPE_LABELS, SUMMARY_BLOCK_LABELS, BLOCK_FIELD_LABELS,
} from '../../../../utils/expDocConstants';
import ColumnsEditor from './ColumnsEditor';
import { listEditor, withRowKeys, newRowKey, evidenceColumn } from './editorKit';
import { RowTools } from './EditorParts';

const { Text } = Typography;

const SECTION_OPTIONS = [{ value: 'MAIN', label: 'Main cartons' }, { value: 'EXTRA', label: 'Extra cartons' }];
const PACK_OPTIONS = Object.values(PACKING_TYPE).filter((p) => p !== PACKING_TYPE.EXTRA)
  .map((p) => ({ value: p, label: PACKING_TYPE_LABELS[p] }));
const BLOCK_OPTIONS = Object.entries(SUMMARY_BLOCK_LABELS).map(([value, label]) => ({ value, label }));
const BLOCK_BY_OPTIONS = Object.entries(BLOCK_FIELD_LABELS).map(([value, label]) => ({ value, label }));
const ROW_CATEGORIES = ['ROW', 'CALC', 'STYLE', 'PL'];

/**
 * The packing list's sections, in print order.
 *
 * A grid sheet prints the sections it includes; naming packing types splits them the
 * way a buyer's layout does ("solid packs" / "ratio packs"), and a row no sheet takes
 * still prints in the first sheet of its section. A sheet may carry its own columns
 * and repeat a heading and subtotal per order or style.
 */
const SheetsEditor = ({ sheets, onChange, locked, meta, onEvidence }) => {
  const list = listEditor(sheets, onChange);
  const rows = sheets || [];

  const details = (r) => (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={10}>
          <Text type="secondary">Repeat a heading and subtotal for each</Text>
          <FormSelect
            variant="multi" size="small" style={{ width: '100%' }} disabled={locked}
            value={r.blockBy || []} placeholder="No blocks — one table"
            onChange={(v) => list.set(r.__row, { blockBy: v?.length ? v : undefined })} options={BLOCK_BY_OPTIONS}
          />
        </Col>
        <Col xs={24} md={10}>
          <Text type="secondary">Block heading</Text>
          <Input size="small" name={`sheet-blocktitle-${r.__row}`} disabled={locked || !r.blockBy?.length}
            value={r.blockTitle || ''} placeholder="e.g. ORDER NO {{row.buyerPoNo}}  STYLE NO: {{row.styleNo}}"
            onChange={(e) => list.set(r.__row, { blockTitle: e.target.value || undefined })} />
        </Col>
        <Col xs={24} md={4}>
          <Text type="secondary">Subtotal per block</Text>
          <div>
            <Switch size="small" disabled={locked || !r.blockBy?.length} checked={r.blockTotals !== false}
              onChange={(v) => list.set(r.__row, { blockTotals: v })} />
          </div>
        </Col>
      </Row>
      <div>
        <Text strong>Columns for this section</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
          Leave empty to print the main grid columns. Add columns when this section&apos;s table differs.
        </Text>
        <ColumnsEditor
          columns={r.columns} onChange={(v) => list.set(r.__row, { columns: v?.length ? v : undefined })}
          locked={locked} categories={ROW_CATEGORIES} meta={meta} metaList={`sheets:${r.key}.columns`}
          onEvidence={onEvidence} emptyText="Uses the main grid columns." addLabel="Add a column for this section"
          namePrefix={`sheet${r.__row}`}
        />
      </div>
    </Space>
  );

  return (
    <>
      <Table
        size="small"
        rowKey="__row"
        pagination={false}
        scroll={{ x: 1000 }}
        dataSource={withRowKeys(rows)}
        expandable={{ expandedRowRender: details, rowExpandable: (r) => r.type !== 'SUMMARY' }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="One sheet is produced, holding the main section." /> }}
        columns={[
          {
            title: 'Title',
            width: 190,
            render: (_, r) => (
              <Input size="small" name={`sheet-title-${r.__row}`} value={r.title || ''} disabled={locked}
                onChange={(e) => list.set(r.__row, { title: e.target.value })} />
            ),
          },
          {
            title: 'Kind',
            width: 140,
            render: (_, r) => (
              <FormSelect
                variant="default" allowClear={false} size="small" style={{ width: '100%' }} disabled={locked}
                value={r.type === 'SUMMARY' ? 'SUMMARY' : 'GRID'}
                onChange={(v) => list.set(r.__row, v === 'SUMMARY'
                  ? { type: 'SUMMARY', blocks: r.blocks?.length ? r.blocks : ['GRAND_TOTAL'] }
                  : { type: undefined, include: r.include?.length ? r.include : ['MAIN'] })}
                options={[{ value: 'GRID', label: 'Carton table' }, { value: 'SUMMARY', label: 'Summary' }]}
              />
            ),
          },
          {
            title: 'Prints',
            render: (_, r) => (r.type === 'SUMMARY'
              ? (
                <FormSelect variant="multi" size="small" style={{ width: '100%' }} disabled={locked}
                  value={r.blocks || []} onChange={(v) => list.set(r.__row, { blocks: v })} options={BLOCK_OPTIONS} />
              )
              : (
                <Space.Compact block>
                  <FormSelect variant="multi" size="small" style={{ width: '45%' }} disabled={locked}
                    value={r.include || []} onChange={(v) => list.set(r.__row, { include: v })} options={SECTION_OPTIONS} />
                  <FormSelect variant="multi" size="small" style={{ width: '55%' }} disabled={locked}
                    value={r.packingTypes || []} placeholder="All packing types"
                    onChange={(v) => list.set(r.__row, { packingTypes: v?.length ? v : undefined })} options={PACK_OPTIONS} />
                </Space.Compact>
              )),
          },
          ...evidenceColumn(meta, 'sheets', onEvidence),
          {
            title: '',
            width: 110,
            render: (_, r) => <RowTools index={r.__row} count={rows.length} list={list} disabled={locked} />,
          },
        ]}
      />
      {!locked && (
        <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }}
          onClick={() => list.add({ key: newRowKey('S'), title: '', include: ['MAIN'], showSectionTotals: true })}>
          Add sheet
        </Button>
      )}
      {rows.length > 0 && !rows.some((s) => s.type !== 'SUMMARY' && (s.include || []).includes('EXTRA')) && (
        <Alert type="warning" showIcon style={{ marginTop: 12 }} title="No sheet prints extra cartons"
          description="Leftover cartons would not appear on this packing list. Add a carton-table sheet that includes Extra cartons." />
      )}
    </>
  );
};

export default SheetsEditor;
