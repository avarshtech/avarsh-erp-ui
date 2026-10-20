import { Button, Empty, Input, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../../components/form';
import { STICKER_LINE_KIND } from '../../../../../utils/expDocConstants';
import { askKeyFor, isAskBinding } from '../../../../../utils/expDocTemplateSchema';
import { listEditor, withRowKeys, evidenceColumn } from '../editorKit';
import { RowTools } from '../EditorParts';
import StickerLineSource from './StickerLineSource';
import StickerLineFormat from './StickerLineFormat';
import { KIND_OPTIONS, newLine, switchKind } from './stickerEditorModel';

/**
 * The lines of one sticker face, in print order: what each prints (a field, the carton's
 * size grid, a barcode), its label, where its value comes from, and its format.
 *
 * `takenAskKeys(i)` is every per-run question of the template but line i's, so a question
 * is named after its label and never shares a key — renaming the line renames it.
 */
const StickerLineTable = ({
  face, idBase, onChange, takenAskKeys, locked, meta, onEvidence,
}) => {
  const list = face.lines || [];
  const lines = listEditor(list, onChange);
  const replace = (i, line) => onChange(list.map((l, n) => (n === i ? line : l)));
  const idp = (r) => `${idBase}-${r.key || r.__row}`;
  const nameOf = (r) => r.label || `line ${r.__row + 1}`;
  const setLabel = (r, text) => {
    const label = text === '' ? null : text;
    lines.set(r.__row, isAskBinding(r.binding) ? { label, binding: `ask:${askKeyFor(label, takenAskKeys(r.__row))}` } : { label });
  };

  return (
    <>
      <Table
        size="small"
        rowKey="__row"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={withRowKeys(list)}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No lines on this face yet." /> }}
        columns={[
          {
            title: 'Kind',
            width: 120,
            render: (_, r) => (
              <FormSelect
                id={`${idp(r)}-kind`} aria-label="What the line prints" variant="default" allowClear={false} size="small"
                style={{ width: '100%' }} disabled={locked} options={KIND_OPTIONS} value={r.kind || STICKER_LINE_KIND.FIELD}
                onChange={(kind) => { if (kind !== (r.kind || STICKER_LINE_KIND.FIELD)) replace(r.__row, switchKind(r, kind)); }}
              />
            ),
          },
          {
            title: 'Label',
            width: 170,
            render: (_, r) => (
              <Input size="small" name={`${idp(r)}-label`} aria-label="Label" maxLength={80} disabled={locked}
                placeholder="no label = headline" value={r.label ?? ''} onChange={(e) => setLabel(r, e.target.value)} />
            ),
          },
          {
            title: 'Data source',
            render: (_, r) => (
              <StickerLineSource line={r} takenAskKeys={takenAskKeys(r.__row)} idp={idp(r)} locked={locked}
                onChange={(changes) => lines.set(r.__row, changes)} />
            ),
          },
          {
            title: 'Format',
            width: 64,
            align: 'center',
            render: (_, r) => (
              <StickerLineFormat line={r} name={nameOf(r)} idp={idp(r)} locked={locked} onChange={(changes) => lines.set(r.__row, changes)} />
            ),
          },
          ...evidenceColumn(meta, `faces:${face.key}.lines`, onEvidence),
          {
            title: '',
            width: 110,
            render: (_, r) => (
              <RowTools index={r.__row} count={list.length} list={lines} disabled={locked} subject={`line ${r.label || r.__row + 1}`} />
            ),
          },
        ]}
      />
      {!locked && (
        <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => lines.add(newLine())}>
          Add line
        </Button>
      )}
    </>
  );
};

export default StickerLineTable;
