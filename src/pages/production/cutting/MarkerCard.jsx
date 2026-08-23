import { useMemo } from 'react';
import { Card, Space, InputNumber, DatePicker, Button, Table, Tag, Tooltip, Input } from 'antd';
import { PlusOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import { LAY_TABLES, MARKER_EFFICIENCY_TARGET } from '../../../utils/cuttingConstants';
import { sizeRatioRows, sizeJumps } from '../../../services/production/cuttingService';
import SizeJumpAlert from './SizeJumpAlert';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * CR Sections B + C — one expandable marker card: marker fields, the
 * size/ratio table (Cut Qty = Height × Ratio on the remaining order qty)
 * and the size-jump panel for any excess.
 */
const MarkerCard = ({ marker, idx, po, markers, onPatch, onAddAfter, onImportExcel, onRemove }) => {
  const rows = useMemo(() => sizeRatioRows(po, markers, idx), [po, markers, idx]);
  const jumps = useMemo(() => sizeJumps(po, rows), [po, rows]);
  const sizeRange = useMemo(() => {
    const covered = rows.filter((r) => r.ratio > 0).map((r) => r.size);
    return covered.length ? `${covered[0]} – ${covered[covered.length - 1]}` : '—';
  }, [rows]);
  const effOk = (marker.efficiencyPct || 0) >= MARKER_EFFICIENCY_TARGET;

  const matrixColumns = useMemo(() => [
    { title: '', dataIndex: 'label', width: 120, fixed: 'left', render: (v) => <strong>{v}</strong> },
    ...(po?.sizes || []).map((size) => ({
      title: <strong>{size}</strong>, dataIndex: size, width: 92, align: 'center',
      render: (v, row) => {
        if (row.key === 'ratio') {
          return <InputNumber size="small" min={0} max={10} value={v || null} style={{ width: 64 }}
            onChange={(val) => onPatch(idx, { ratio: { ...marker.ratio, [size]: val || 0 } })} />;
        }
        if (row.key === 'balance') {
          return <strong style={{ color: v < 0 ? 'var(--error-color)' : v > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>{v}</strong>;
        }
        return v;
      },
    })),
  ], [po, marker.ratio, idx, onPatch]);

  const matrixRows = useMemo(() => {
    const build = (key, label, field) => ({ key, label, ...Object.fromEntries(rows.map((r) => [r.size, r[field]])) });
    return [
      build('ratio', 'Size / Ratio', 'ratio'),
      build('order', 'Order Qty (remaining)', 'orderQty'),
      build('cut', 'Cut Qty (H × R)', 'cutQty'),
      build('balance', 'Balance', 'balance'),
    ];
  }, [rows]);

  return (
    <Card
      size="small"
      title={(
        <Space size={8}>
          <Tag color="blue"><code>{marker.markerNo}</code></Tag>
          <Tooltip title="Add another marker after this one">
            <Button size="small" icon={<PlusOutlined />} onClick={() => onAddAfter(idx)}>Add Marker</Button>
          </Tooltip>
          <Tooltip title="Import marker data from a CAD / Excel file (mock)">
            <Button size="small" icon={<FileExcelOutlined />} onClick={() => onImportExcel(idx)}>Add Marker (Excel)</Button>
          </Tooltip>
        </Space>
      )}
      extra={markers.length > 1 && (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(idx)} />
      )}
      style={{ marginBottom: 16 }}
    >
      <Space size="middle" wrap align="end" style={{ marginBottom: 12 }}>
        <div>
          <FieldLabel>Fabric Width — Raw Edge (in)</FieldLabel>
          <InputNumber min={20} step={0.5} value={marker.fabricWidthRaw} style={{ width: 110 }} onChange={(v) => onPatch(idx, { fabricWidthRaw: v })} />
        </div>
        <div>
          <FieldLabel>Cuttable Width (in)</FieldLabel>
          <InputNumber min={20} step={0.5} value={marker.cuttableWidth} style={{ width: 110 }} onChange={(v) => onPatch(idx, { cuttableWidth: v })} />
        </div>
        <div>
          <FieldLabel>Marker Length (m)</FieldLabel>
          <InputNumber min={0.5} step={0.1} value={marker.markerLength} style={{ width: 100 }} onChange={(v) => onPatch(idx, { markerLength: v })} />
        </div>
        <div>
          <FieldLabel>Marker Height (plies)</FieldLabel>
          <InputNumber min={1} value={marker.markerHeight} style={{ width: 100 }} onChange={(v) => onPatch(idx, { markerHeight: v })} />
        </div>
        <div>
          <FieldLabel>Efficiency % (target ≥ {MARKER_EFFICIENCY_TARGET})</FieldLabel>
          <Space size={6}>
            <InputNumber min={40} max={99} value={marker.efficiencyPct} style={{ width: 80 }} onChange={(v) => onPatch(idx, { efficiencyPct: v })} />
            {marker.efficiencyPct != null && (effOk ? <Tag color="green">On target</Tag> : <Tag color="orange">Below {MARKER_EFFICIENCY_TARGET}%</Tag>)}
          </Space>
        </div>
        <div>
          <FieldLabel>Size Range</FieldLabel>
          <Tag>{sizeRange}</Tag>
        </div>
        <div>
          <FieldLabel>Lay Plan Dt</FieldLabel>
          <DatePicker format="DD-MMM" value={marker.layPlanDate ? dayjs(marker.layPlanDate) : null}
            onChange={(d) => onPatch(idx, { layPlanDate: d ? d.format('YYYY-MM-DD') : null })} style={{ width: 110 }} />
        </div>
        <div>
          <FieldLabel>Cut Plan Dt</FieldLabel>
          <DatePicker format="DD-MMM" value={marker.cutPlanDate ? dayjs(marker.cutPlanDate) : null}
            onChange={(d) => onPatch(idx, { cutPlanDate: d ? d.format('YYYY-MM-DD') : null })} style={{ width: 110 }} />
        </div>
        <div>
          <FieldLabel>Lay Table #</FieldLabel>
          <FormSelect value={marker.layTableNo} style={{ width: 80 }} placeholder="#"
            options={LAY_TABLES.map((t) => ({ value: t, label: t }))} onChange={(v) => onPatch(idx, { layTableNo: v })} />
        </div>
        <div>
          <FieldLabel>CAD File</FieldLabel>
          <Input size="middle" value={marker.cadFile} placeholder="e.g. HM-TS-2601-M1.cut" style={{ width: 190 }}
            onChange={(e) => onPatch(idx, { cadFile: e.target.value })} />
        </div>
      </Space>

      <Table rowKey="key" size="small" columns={matrixColumns} dataSource={matrixRows}
        pagination={false} scroll={{ x: 600 }}
        footer={() => (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Positive balance carries forward as “Balance to Cut” for the next marker; negative balance triggers a Size Jump.
          </span>
        )} />
      <SizeJumpAlert jumps={jumps} />
    </Card>
  );
};

export default MarkerCard;
