import { useMemo } from 'react';
import { Table, Tag, Tooltip, Typography } from 'antd';
import { PACKING_TYPE_LABELS } from '../../../utils/expDocConstants';
import {
  cartonCount, piecesPerCarton, totalPieces, cbmPerCarton, dimensionsLabel, sizeQtyPerCarton,
  formatRanges, sectionTotals,
} from '../../../utils/expDocCalc';
import { expandColumns, resolveBinding, formatBound } from '../../../utils/expDocTemplateSchema';

const { Text } = Typography;

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Read-only carton grid for one packing-list section.
 *
 * Columns come from the buyer template, expanded against the frozen size list — the
 * SAME spec the printed document uses, which is what stops the screen and the paper
 * drifting apart. Carton data is never editable here: corrections are made in the
 * packing entry and refreshed in (PRD §7).
 */
const PlCartonGrid = ({ section, sizes, template, issuesByRow = {} }) => {
  const rows = useMemo(() => section?.rows || [], [section]);

  const columns = useMemo(() => {
    const spec = expandColumns(template, sizes);

    // A template with no column set still has to render something useful.
    if (!spec.length) {
      return [
        { title: 'Cartons', key: 'range', width: 120, render: (_, r) => formatRanges([{ from: r.cartonFrom, to: r.cartonTo }]) },
        { title: 'Colour', dataIndex: 'colorName', width: 180, render: (v) => v || '—' },
        { title: 'Pcs/Ctn', key: 'ppc', width: 90, align: 'right', render: (_, r) => piecesPerCarton(r) },
      ];
    }

    return spec.map((col) => ({
      title: col.isSizeColumn
        ? col.label
        : <span style={{ whiteSpace: 'nowrap' }}>{col.label}</span>,
      key: col.key,
      width: col.width || 120,
      align: col.align,
      ellipsis: !col.isSizeColumn && col.width > 100,
      render: (_, row) => {
        // Derived values are always recomputed (BR-06), never read from the row.
        switch (col.binding) {
          case 'row.cartonRange':
            return <Text style={{ whiteSpace: 'nowrap' }}>{formatRanges([{ from: row.cartonFrom, to: row.cartonTo }])}</Text>;
          case 'row.cartonCount':
            return num(cartonCount(row));
          case 'calc.piecesPerCarton':
            return <Text style={{ fontStyle: 'italic' }}>{num(piecesPerCarton(row))}</Text>;
          case 'calc.totalPieces':
            return <Text strong style={{ fontStyle: 'italic' }}>{num(totalPieces(row))}</Text>;
          case 'calc.cbm':
            return <Text style={{ fontStyle: 'italic' }}>{num(cbmPerCarton(row), 3)}</Text>;
          case 'calc.dimensions':
            return <Text style={{ whiteSpace: 'nowrap' }}>{dimensionsLabel(row) || '—'}</Text>;
          default:
            break;
        }
        if (col.isSizeColumn) {
          const qty = sizeQtyPerCarton(row)[col.size];
          return qty ? num(qty) : <Text type="secondary">—</Text>;
        }
        if (col.binding === 'row.packingType') {
          return PACKING_TYPE_LABELS[row.packingType] || row.packingType;
        }
        const value = resolveBinding(col.binding, { row, calc: {} }, { decimals: col.decimals });
        return formatBound(value, { decimals: col.decimals, prefix: col.prefix, suffix: col.suffix });
      },
    }));
  }, [template, sizes]);

  const totals = useMemo(() => sectionTotals(rows), [rows]);

  const summary = useMemo(() => () => {
    const spec = expandColumns(template, sizes);
    if (!spec.length) return null;
    return (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
          {spec.map((col, index) => {
            const cell = (content, align) => (
              <Table.Summary.Cell key={col.key} index={index} align={align || col.align}>
                {content}
              </Table.Summary.Cell>
            );
            if (index === 0) return cell(<Text strong>Section total</Text>);
            if (col.binding === 'row.cartonCount') return cell(<Text strong>{num(totals.cartons)}</Text>);
            if (col.isSizeColumn) {
              const v = totals.sizeQty?.[col.size];
              return cell(v ? <Text strong>{num(v)}</Text> : null);
            }
            if (col.binding === 'calc.totalPieces') return cell(<Text strong>{num(totals.pieces)}</Text>);
            if (col.binding === 'row.netWeightKg') return cell(<Text strong>{num(totals.netWeightKg, 3)}</Text>);
            if (col.binding === 'row.grossWeightKg') return cell(<Text strong>{num(totals.grossWeightKg, 3)}</Text>);
            if (col.binding === 'calc.cbm') return cell(<Text strong>{num(totals.cbm, 3)}</Text>);
            return cell(null);
          })}
        </Table.Summary.Row>
      </Table.Summary>
    );
  }, [template, sizes, totals]);

  const scrollX = useMemo(
    () => expandColumns(template, sizes).reduce((sum, c) => sum + (c.width || 120), 0) || 1200,
    [template, sizes],
  );

  return (
    <Table
      columns={columns}
      dataSource={rows}
      rowKey="id"
      size="small"
      bordered
      pagination={false}
      scroll={{ x: scrollX }}
      summary={summary}
      rowClassName={(row) =>
        (issuesByRow[row.id] || []).some((i) => i.severity === 'ERROR') ? 'expdoc-row-error' : ''}
      locale={{ emptyText: 'No cartons in this section.' }}
      expandable={{
        rowExpandable: (row) => Boolean(row.mixedRows?.length),
        expandedRowRender: (row) => (
          <div style={{ padding: '4px 0 4px 24px' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              Colours inside every carton of this range
            </Text>
            {(row.mixedRows || []).map((mr, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <Text strong style={{ display: 'inline-block', minWidth: 200 }}>{mr.colorName || '—'}</Text>
                {sizes.map((size) => (
                  (mr.sizeQty || {})[size] ? (
                    <Tag key={size} style={{ marginInlineEnd: 6 }}>{`${size}: ${mr.sizeQty[size]}`}</Tag>
                  ) : null
                ))}
              </div>
            ))}
          </div>
        ),
      }}
      title={() => (
        <Tooltip title="Carton data is read-only here — corrections are made in the packing entry and refreshed in.">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`${num(totals.cartons)} carton(s) · ${num(totals.pieces)} pcs · read-only`}
          </Text>
        </Tooltip>
      )}
    />
  );
};

export default PlCartonGrid;
