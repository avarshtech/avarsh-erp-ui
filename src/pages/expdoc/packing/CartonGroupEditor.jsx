import { useCallback, useMemo } from 'react';
import { App, Button, Input, InputNumber, Select, Space, Table, Tooltip, Typography } from 'antd';
import { DeleteOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { SectionAddButton } from '../../../components/buttons';
import { numericInputProps, integerInputProps } from '../../../utils/inputHelpers';
import {
  PACKING_TYPE, PACKING_TYPE_LIST, PACKING_TYPE_LABELS, PACKING_TYPE_HINTS,
} from '../../../utils/expDocConstants';
import {
  cartonCount, piecesPerCarton, totalPieces, cbmPerCarton, sizeQtyPerCarton,
} from '../../../utils/expDocCalc';

const { Text } = Typography;

/** Which map a size cell writes into, per packing type. */
const sizeFieldFor = (type) =>
  (type === PACKING_TYPE.RATIO || type === PACKING_TYPE.MPB ? 'ratio' : 'sizeQty');

/** What a size cell MEANS, per packing type — shown as a column tooltip. */
const SIZE_HEADER_HINT = {
  [PACKING_TYPE.SOLID]: 'Pieces of this size in one carton',
  [PACKING_TYPE.EXTRA]: 'Pieces of this size in the carton',
  [PACKING_TYPE.RATIO]: 'Pieces of this size in one assortment',
  [PACKING_TYPE.MPB]: 'Pieces of this size in one master polybag',
  [PACKING_TYPE.MIXED]: 'Total across the colour rows — edit inside the expanded row',
};

/**
 * Read-only cell.
 *
 * Read-only data renders as muted text, never as a disabled input. That is what
 * PRD §11.3 asks for, and it also sidesteps the app-wide dark-theme token
 * (colorTextDisabled: rgba(255,255,255,0.25)) that leaves disabled controls
 * close to illegible on a dark background.
 */
const ReadCell = ({ value, dp, suffix }) => {
  const empty = value === null || value === undefined || value === '';
  const shown = empty
    ? '—'
    : `${dp != null ? Number(value).toFixed(dp) : value}${suffix && !empty ? suffix : ''}`;
  return <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{shown}</Text>;
};

const blankGroup = (sectionKey, packingType, afterCarton) => ({
  id: `tmp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
  sectionKey,
  packingType,
  cartonFrom: afterCarton ? afterCarton + 1 : 1,
  cartonTo: afterCarton ? afterCarton + 1 : 1,
  packingCode: null,
  endCustomer: null,
  danNo: null,
  buyerPoNo: null,
  destination: null,
  styleNo: null,
  colorName: null,
  sizeQty: {},
  mixedRows: null,
  ratio: null,
  assortmentsPerCarton: null,
  pcsPerMpb: null,
  mpbPerCarton: null,
  netWeightKg: null,
  grossWeightKg: null,
  lengthCm: null,
  breadthCm: null,
  heightCm: null,
  remarks: null,
  completionFlag: false,
});

/**
 * Inline carton-group grid.
 *
 * One row is a RANGE of identical cartons, not one carton — which is what lets a
 * 900-carton shipment be four rows. The quantity columns change meaning with the
 * packing type, so the header carries a tooltip explaining what a cell holds.
 */
const CartonGroupEditor = ({
  sizes = [],
  groups = [],
  sectionKey,
  readOnly = false,
  issuesByRow = {},
  styleNo,
  buyerPoNo,
  // §10.1: a template narrows which pack structures its buyer uses — VGT packs solid
  // and mixed only. Offering all five let a packer build a carton the buyer's layout
  // has no columns to print.
  allowedPackingTypes,
  onChange,
}) => {
  const { modal } = App.useApp();

  const rows = useMemo(
    () => groups.filter((g) => (g.sectionKey || 'MAIN') === sectionKey),
    [groups, sectionKey],
  );

  const packingTypeOptions = useMemo(() => {
    const allowed = allowedPackingTypes?.length ? new Set(allowedPackingTypes) : null;
    return PACKING_TYPE_LIST
      // A type already in use stays selectable even if the template later dropped it,
      // so an existing carton never becomes uneditable.
      .filter((t) => !allowed || allowed.has(t.value) || rows.some((r) => r.packingType === t.value))
      .map((t) => ({ value: t.value, label: t.label }));
  }, [allowedPackingTypes, rows]);

  const replaceRow = useCallback(
    (rowId, patch) => {
      onChange(groups.map((g) => (g.id === rowId ? { ...g, ...patch } : g)));
    },
    [groups, onChange],
  );

  const setCell = useCallback(
    (rowId, field, value) => replaceRow(rowId, { [field]: value }),
    [replaceRow],
  );

  const setSizeCell = useCallback(
    (row, size, value) => {
      const field = sizeFieldFor(row.packingType);
      const next = { ...(row[field] || {}) };
      if (value == null || value === '') delete next[size];
      else next[size] = Number(value);
      replaceRow(row.id, { [field]: next });
    },
    [replaceRow],
  );

  /** Switching type discards the quantity shape that no longer applies — confirm first. */
  const setPackingType = useCallback(
    (row, nextType) => {
      const carriesData =
        Object.keys(row.sizeQty || {}).length
        || Object.keys(row.ratio || {}).length
        || (row.mixedRows || []).length;
      const apply = () => {
        replaceRow(row.id, {
          packingType: nextType,
          sizeQty: nextType === PACKING_TYPE.MIXED ? null : {},
          ratio: nextType === PACKING_TYPE.RATIO || nextType === PACKING_TYPE.MPB ? {} : null,
          mixedRows: nextType === PACKING_TYPE.MIXED ? [{ colorName: '', sizeQty: {} }] : null,
          assortmentsPerCarton: nextType === PACKING_TYPE.RATIO ? row.assortmentsPerCarton : null,
          pcsPerMpb: nextType === PACKING_TYPE.MPB ? row.pcsPerMpb : null,
          mpbPerCarton: nextType === PACKING_TYPE.MPB ? row.mpbPerCarton : null,
        });
      };
      if (!carriesData) { apply(); return; }
      modal.confirm({
        title: 'Change packing type?',
        content: 'The quantities entered for the current type will be cleared.',
        okText: 'Change and clear',
        okButtonProps: { danger: true },
        onOk: apply,
      });
    },
    [replaceRow, modal],
  );

  const addRow = useCallback(() => {
    const lastCarton = groups.reduce((max, g) => Math.max(max, Number(g.cartonTo) || 0), 0);
    onChange([
      ...groups,
      { ...blankGroup(sectionKey, PACKING_TYPE.SOLID, lastCarton), styleNo, buyerPoNo },
    ]);
  }, [groups, onChange, sectionKey, styleNo, buyerPoNo]);

  const duplicateRow = useCallback(
    (row) => {
      const lastCarton = groups.reduce((max, g) => Math.max(max, Number(g.cartonTo) || 0), 0);
      const span = cartonCount(row) || 1;
      onChange([
        ...groups,
        {
          ...row,
          id: `tmp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          cartonFrom: lastCarton + 1,
          cartonTo: lastCarton + span,
        },
      ]);
    },
    [groups, onChange],
  );

  const removeRow = useCallback(
    (row) => onChange(groups.filter((g) => g.id !== row.id)),
    [groups, onChange],
  );

  const setMixedRow = useCallback(
    (row, index, patch) => {
      const next = (row.mixedRows || []).map((mr, i) => (i === index ? { ...mr, ...patch } : mr));
      replaceRow(row.id, { mixedRows: next });
    },
    [replaceRow],
  );

  const columns = useMemo(() => {
    const cols = [
      {
        title: 'Packing type',
        dataIndex: 'packingType',
        width: 150,
        fixed: 'left',
        render: (value, row) => (readOnly ? (
          <Text style={{ whiteSpace: 'nowrap' }}>{PACKING_TYPE_LABELS[value] || value}</Text>
        ) : (
          <Tooltip title={PACKING_TYPE_HINTS[value]}>
            <Select
              size="small"
              value={value}
              onChange={(v) => setPackingType(row, v)}
              options={packingTypeOptions}
              style={{ width: '100%' }}
            />
          </Tooltip>
        )),
      },
      {
        title: 'From',
        dataIndex: 'cartonFrom',
        width: 84,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <InputNumber
            size="small" {...integerInputProps} min={1} value={value}
            status={(issuesByRow[row.id] || []).some((i) => i.code === 'V-02' || i.code === 'V-06') ? 'error' : undefined}
            onChange={(v) => setCell(row.id, 'cartonFrom', v)} style={{ width: '100%' }}
          />
        )),
      },
      {
        title: 'To',
        dataIndex: 'cartonTo',
        width: 84,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <InputNumber
            size="small" {...integerInputProps} min={1} value={value}
            status={(issuesByRow[row.id] || []).some((i) => i.code === 'V-02' || i.code === 'V-06') ? 'error' : undefined}
            onChange={(v) => setCell(row.id, 'cartonTo', v)} style={{ width: '100%' }}
          />
        )),
      },
      {
        title: 'Ctns',
        key: 'cartonCount',
        width: 66,
        align: 'right',
        render: (_, row) => <Text type="secondary">{cartonCount(row)}</Text>,
      },
      {
        title: 'DAN No.',
        dataIndex: 'danNo',
        width: 116,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <Input size="small" value={value ?? ''}
            onChange={(e) => setCell(row.id, 'danNo', e.target.value)} />
        )),
      },
      {
        title: 'End customer',
        dataIndex: 'endCustomer',
        width: 140,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <Input size="small" value={value ?? ''}
            onChange={(e) => setCell(row.id, 'endCustomer', e.target.value)} />
        )),
      },
      {
        title: 'PO No.',
        dataIndex: 'buyerPoNo',
        width: 130,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <Input size="small" value={value ?? ''}
            onChange={(e) => setCell(row.id, 'buyerPoNo', e.target.value)} />
        )),
      },
      {
        title: 'Colour',
        dataIndex: 'colorName',
        width: 170,
        render: (value, row) =>
          row.packingType === PACKING_TYPE.MIXED ? (
            <Text type="secondary">Per colour row</Text>
          ) : readOnly ? <ReadCell value={value} /> : (
            <Input size="small" value={value ?? ''}
              placeholder="Navy or 19-4052 TCX"
              onChange={(e) => setCell(row.id, 'colorName', e.target.value)} />
          ),
      },
    ];

    sizes.forEach((size) => {
      cols.push({
        title: size,
        key: `size-${size}`,
        width: 76,
        align: 'right',
        render: (_, row) => {
          const field = sizeFieldFor(row.packingType);
          if (row.packingType === PACKING_TYPE.MIXED) {
            const agg = sizeQtyPerCarton(row)[size];
            return <Text type="secondary">{agg || '—'}</Text>;
          }
          if (readOnly) return <ReadCell value={(row[field] || {})[size] ?? null} />;
          return (
            <Tooltip title={SIZE_HEADER_HINT[row.packingType]}>
              <InputNumber
                size="small" {...integerInputProps} min={0}
                value={(row[field] || {})[size] ?? null}
                onChange={(v) => setSizeCell(row, size, v)}
                style={{ width: '100%' }}
              />
            </Tooltip>
          );
        },
      });
    });

    cols.push(
      {
        title: <Tooltip title="Assortments per carton — ratio packing only">Asst/Ctn</Tooltip>,
        dataIndex: 'assortmentsPerCarton',
        width: 92,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <InputNumber
            size="small" {...integerInputProps} min={0} value={value ?? null}
            disabled={row.packingType !== PACKING_TYPE.RATIO}
            onChange={(v) => setCell(row.id, 'assortmentsPerCarton', v)} style={{ width: '100%' }}
          />
        )),
      },
      {
        title: <Tooltip title="Master polybags per carton — MPB packing only">MPB/Ctn</Tooltip>,
        dataIndex: 'mpbPerCarton',
        width: 92,
        render: (value, row) => (readOnly ? <ReadCell value={value} /> : (
          <InputNumber
            size="small" {...integerInputProps} min={0} value={value ?? null}
            disabled={row.packingType !== PACKING_TYPE.MPB}
            onChange={(v) => setCell(row.id, 'mpbPerCarton', v)} style={{ width: '100%' }}
          />
        )),
      },
      {
        title: 'Pcs/Ctn',
        key: 'piecesPerCarton',
        width: 86,
        align: 'right',
        // Always recomputed (BR-06) — never an editable stored value.
        render: (_, row) => <Text strong style={{ fontStyle: 'italic' }}>{piecesPerCarton(row)}</Text>,
      },
      {
        title: 'Total pcs',
        key: 'totalPieces',
        width: 98,
        align: 'right',
        render: (_, row) => <Text strong style={{ fontStyle: 'italic' }}>{totalPieces(row).toLocaleString('en-IN')}</Text>,
      },
      {
        title: 'N.W. (kg)',
        dataIndex: 'netWeightKg',
        width: 98,
        render: (value, row) => (readOnly ? <ReadCell value={value} dp={3} /> : (
          <InputNumber
            size="small" {...numericInputProps} min={0} precision={3} value={value ?? null}
            onChange={(v) => setCell(row.id, 'netWeightKg', v)} style={{ width: '100%' }}
          />
        )),
      },
      {
        title: 'G.W. (kg)',
        dataIndex: 'grossWeightKg',
        width: 98,
        render: (value, row) => (readOnly ? <ReadCell value={value} dp={3} /> : (
          <InputNumber
            size="small" {...numericInputProps} min={0} precision={3} value={value ?? null}
            status={(issuesByRow[row.id] || []).some((i) => i.code === 'V-07') ? 'error' : undefined}
            onChange={(v) => setCell(row.id, 'grossWeightKg', v)} style={{ width: '100%' }}
          />
        )),
      },
      ...['lengthCm', 'breadthCm', 'heightCm'].map((field, i) => ({
        title: ['L (cm)', 'B (cm)', 'H (cm)'][i],
        dataIndex: field,
        width: 80,
        render: (value, row) => (readOnly ? <ReadCell value={value} dp={1} /> : (
          <InputNumber
            size="small" {...numericInputProps} min={0} precision={1} value={value ?? null}
            onChange={(v) => setCell(row.id, field, v)} style={{ width: '100%' }}
          />
        )),
      })),
      {
        title: 'CBM',
        key: 'cbm',
        width: 86,
        align: 'right',
        render: (_, row) => <Text style={{ fontStyle: 'italic' }}>{cbmPerCarton(row).toFixed(3)}</Text>,
      },
    );

    if (!readOnly) {
      cols.push({
        title: '',
        key: 'rowActions',
        fixed: 'right',
        width: 74,
        render: (_, row) => (
          <Space size={2}>
            <Tooltip title="Duplicate as the next carton range">
              <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => duplicateRow(row)} />
            </Tooltip>
            <Tooltip title="Remove this carton group">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(row)} />
            </Tooltip>
          </Space>
        ),
      });
    }

    return cols;
  }, [sizes, readOnly, issuesByRow, packingTypeOptions, setCell, setSizeCell, setPackingType, duplicateRow, removeRow]);

  const expandable = useMemo(
    () => ({
      // Only mixed cartons expand — they are the one type with per-colour rows.
      rowExpandable: (row) => row.packingType === PACKING_TYPE.MIXED,
      expandedRowRender: (row) => (
        <div style={{ padding: '8px 0 8px 24px' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Colours inside every carton of this range
          </Text>
          {/* display:flex on each row forces one colour per line — Space is
              inline-flex by default, which lets consecutive rows sit side by side. */}
          {(row.mixedRows || []).map((mr, index) => (
            <Space key={index} align="end" wrap style={{ display: 'flex', marginBottom: 10 }}>
              {readOnly ? (
                <Text strong style={{ width: 190, display: 'inline-block' }}>{mr.colorName || '—'}</Text>
              ) : (
                <Input
                  size="small" style={{ width: 190 }} placeholder="Colour"
                  value={mr.colorName ?? ''}
                  onChange={(e) => setMixedRow(row, index, { colorName: e.target.value })}
                />
              )}
              {/* The size is a stacked caption rather than an InputNumber addon —
                  `addonBefore`/`addonAfter` are deprecated in AntD 6. */}
              {sizes.map((size) => (
                <div key={size} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{size}</Text>
                  {readOnly ? <ReadCell value={(mr.sizeQty || {})[size] ?? null} /> : (
                  <InputNumber
                    size="small" style={{ width: 76 }} {...integerInputProps} min={0}
                    value={(mr.sizeQty || {})[size] ?? null}
                    onChange={(v) => {
                      const next = { ...(mr.sizeQty || {}) };
                      if (v == null) delete next[size];
                      else next[size] = Number(v);
                      setMixedRow(row, index, { sizeQty: next });
                    }}
                  />
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  size="small" type="text" danger icon={<DeleteOutlined />}
                  onClick={() => replaceRow(row.id, {
                    mixedRows: (row.mixedRows || []).filter((_, i) => i !== index),
                  })}
                />
              )}
            </Space>
          ))}
          {!readOnly && (
            <Button
              size="small" type="dashed" icon={<PlusOutlined />}
              onClick={() => replaceRow(row.id, {
                mixedRows: [...(row.mixedRows || []), { colorName: '', sizeQty: {} }],
              })}
            >
              Add colour
            </Button>
          )}
        </div>
      ),
    }),
    [sizes, readOnly, setMixedRow, replaceRow],
  );

  const scrollX = 1100 + sizes.length * 76 + 640;

  return (
    <>
      <Table
        columns={columns}
        dataSource={rows}
        rowKey="id"
        size="small"
        bordered
        pagination={false}
        scroll={{ x: scrollX }}
        expandable={expandable}
        rowClassName={(row) =>
          (issuesByRow[row.id] || []).some((i) => i.severity === 'ERROR') ? 'expdoc-row-error' : ''
        }
        locale={{ emptyText: 'No carton groups in this section yet.' }}
      />
      {!readOnly && (
        <SectionAddButton text="Add carton group" onClick={addRow} />
      )}
    </>
  );
};

export default CartonGroupEditor;
