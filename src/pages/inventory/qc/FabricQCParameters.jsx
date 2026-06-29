import { memo, useMemo } from 'react';
import { Card, InputNumber, Rate, Tag, Typography, Table, Empty } from 'antd';
import {
  FABRIC_QC_PARAMETERS,
  FABRIC_QC_TOLERANCE_PCT,
} from '../../../utils/inventoryConstants';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;

/**
 * Normalised QC parameter row shape (A7):
 *   { key, label, unit, standard?, actual, result? }
 *
 * Three parameter flavours handled by this table:
 *   1. Numeric with tolerance (gsm, width, tensileStrength) — standard + actual + computed result
 *      via the ±5% tolerance rule (FABRIC_QC_TOLERANCE_PCT).
 *   2. Rating 1–5 (shadeMatch, colorFastnessWash, colorFastnessRub, pillingResistance) —
 *      actual only, rendered as stars.
 *   3. Percentage (shrinkageLength, shrinkageWidth) — actual only, signed number.
 *
 * The `type` on FABRIC_QC_PARAMETERS drives the editor widget. Pass/Fail chips only appear on
 * numeric parameters — ratings and percentages show a dash.
 */

const isNumericParam = (type) => type === 'number';
const isRatingParam = (type) => type === 'rating';

const computeResult = (type, standard, actual) => {
  if (actual == null || actual === '') return null;
  if (!isNumericParam(type)) return null;
  if (standard == null || standard === '') return null;
  const tolerance = standard * (FABRIC_QC_TOLERANCE_PCT / 100);
  return Math.abs(Number(actual) - Number(standard)) <= tolerance ? 'Pass' : 'Fail';
};

/**
 * Convert the canonical parameter-row array (from the mock/API payload) into
 * a lookup keyed by param.key so the render loop can match it against the
 * FABRIC_QC_PARAMETERS definition list.
 */
const buildRowLookup = (rows = []) => {
  const map = new Map();
  rows.forEach((r) => { if (r?.key) map.set(r.key, r); });
  return map;
};

const FabricQCParameters = memo(function FabricQCParameters({
  parameters = [],
  onParameterChange,
  readOnly = false,
}) {
  // Accept legacy nested-object shape OR new row-array — new is the canonical.
  const rows = Array.isArray(parameters) ? parameters : [];
  const rowLookup = useMemo(() => buildRowLookup(rows), [rows]);

  const updateRow = (key, patch) => {
    if (!onParameterChange) return;
    const existing = rowLookup.get(key) || { key };
    const definition = FABRIC_QC_PARAMETERS.find((p) => p.key === key) || {};
    const next = {
      key,
      label: definition.label,
      unit: definition.unit,
      ...existing,
      ...patch,
    };
    // Recompute result for numeric parameters
    if (isNumericParam(definition.type)) {
      next.result = computeResult(definition.type, next.standard, next.actual);
    }
    onParameterChange(key, next);
  };

  const dataSource = FABRIC_QC_PARAMETERS.map((def) => {
    const row = rowLookup.get(def.key) || {};
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      type: def.type,
      standard: row.standard ?? null,
      actual: row.actual ?? null,
      result: row.result ?? computeResult(def.type, row.standard, row.actual),
    };
  });

  const columns = [
    {
      title: 'Parameter',
      dataIndex: 'label',
      key: 'label',
      render: (label, row) => (
        <span>
          <Text style={{ fontSize: 13 }}>{label}</Text>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({row.unit})</Text>
        </span>
      ),
      width: '30%',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Standard</div>,
      dataIndex: 'standard',
      key: 'standard',
      align: 'center',
      width: '25%',
      render: (val, row) => {
        if (isRatingParam(row.type)) return <Text type="secondary" style={{ fontSize: 12 }}>Grade 1-5</Text>;
        if (!isNumericParam(row.type)) return <Text type="secondary">—</Text>;
        if (readOnly) return <Text>{val ?? '—'}</Text>;
        return (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={val}
            controls={false}
            onChange={(v) => updateRow(row.key, { standard: v })}
            {...numericInputProps}
          />
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Actual</div>,
      dataIndex: 'actual',
      key: 'actual',
      align: 'center',
      width: '25%',
      render: (val, row) => {
        if (isRatingParam(row.type)) {
          return (
            <Rate
              value={typeof val === 'number' ? val : 0}
              disabled={readOnly}
              onChange={(v) => updateRow(row.key, { actual: v })}
              style={{ fontSize: 16, color: 'var(--warning-color)' }}
              className="qc-rate-themed"
            />
          );
        }
        if (readOnly) return <Text>{val ?? '—'}</Text>;
        return (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={val}
            controls={false}
            onChange={(v) => updateRow(row.key, { actual: v })}
            {...numericInputProps}
          />
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Result</div>,
      dataIndex: 'result',
      key: 'result',
      align: 'center',
      width: '20%',
      render: (val) => {
        if (!val) return <Text type="secondary">—</Text>;
        return <Tag color={val === 'Pass' ? 'green' : 'red'}>{val}</Tag>;
      },
    },
  ];

  return (
    <Card title="QC Parameters" size="small">
      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        locale={{ emptyText: <Empty description="No parameters defined." /> }}
      />
    </Card>
  );
});

export default FabricQCParameters;
