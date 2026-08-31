import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Button, Space, Tag, DatePicker, Input } from 'antd';
import { PlusOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { allowanceQty, totalAllowanceQty } from '../../../utils/cuttingCalc';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * CAD-marker-sheet layout (cutting_marker.png): sizes as columns; QUANTITY and
 * +allowance% rows on top; ONE row per marker (height + ratio per size + qty);
 * TOTAL row at the bottom. Marker details sit in the row expansion.
 */
const MarkerMatrix = ({ po, plan, onPatchMarker, onAddMarker, onRemoveMarker, onImportExcel }) => {
  const { tableOptions, threshold } = useCuttingMasters();
  const efficiencyTarget = threshold('MARKER_EFFICIENCY_TARGET', 85);
  const pcsOf = useCallback((m) => (po?.sizes || []).reduce((s, sz) => s + (m.ratio?.[sz] || 0), 0), [po]);

  const rows = useMemo(() => [
    { type: 'qty' },
    { type: 'allow' },
    ...plan.markers.map((m, idx) => ({ type: 'marker', idx, ...m })),
  ], [plan.markers]);

  const totals = useMemo(() => {
    const perSize = Object.fromEntries((po?.sizes || []).map((sz) => [sz,
      plan.markers.reduce((s, m) => s + (m.markerHeight || 0) * (m.ratio?.[sz] || 0), 0)]));
    const grand = Object.values(perSize).reduce((a, b) => a + b, 0);
    return { perSize, grand };
  }, [po, plan.markers]);

  const columns = useMemo(() => [
    {
      title: 'Marker', key: 'label', width: 190, fixed: 'left',
      render: (_, r) => {
        if (r.type === 'qty') return <strong>Quantity (order)</strong>;
        if (r.type === 'allow') return <strong style={{ color: 'var(--primary-color)' }}>+{plan.allowancePct || 0}% (cut qty)</strong>;
        return (
          <Space size={6}>
            <Tag color="blue" style={{ marginInline: 0 }}>
              <code>{r.markerNo || `MK-${String(r.idx + 1).padStart(3, '0')}`}</code>
            </Tag>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>H:</span>
            <InputNumber size="small" min={1} value={r.markerHeight} style={{ width: 70 }}
              onChange={(v) => onPatchMarker(r.idx, { markerHeight: v })} />
          </Space>
        );
      },
    },
    ...(po?.sizes || []).map((size) => ({
      title: <strong>{size}</strong>, key: size, width: 88, align: 'center',
      render: (_, r) => {
        if (r.type === 'qty') return <strong>{po.sizeQty[size]}</strong>;
        if (r.type === 'allow') return <strong style={{ color: 'var(--primary-color)' }}>{allowanceQty(po.sizeQty[size], plan.allowancePct)}</strong>;
        return (
          <InputNumber size="small" min={0} max={10} value={r.ratio?.[size] || null} style={{ width: 60 }}
            placeholder="—" onChange={(v) => onPatchMarker(r.idx, { ratio: { ...r.ratio, [size]: v || 0 } })} />
        );
      },
    })),
    {
      title: 'Pcs / Mkr', key: 'pcs', width: 90, align: 'center',
      render: (_, r) => (r.type === 'marker' ? <Tag>{`${r.markerHeight || 0}=${pcsOf(r)}`}</Tag> : null),
    },
    {
      title: 'Qty', key: 'qty', width: 90, align: 'right',
      render: (_, r) => {
        if (r.type === 'qty') return <strong>{po?.orderQty ?? 0}</strong>;
        if (r.type === 'allow') return <strong style={{ color: 'var(--primary-color)' }}>{totalAllowanceQty(po?.sizes, po?.sizeQty, plan.allowancePct)}</strong>;
        return <strong>{(r.markerHeight || 0) * pcsOf(r)}</strong>;
      },
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, r) => (r.type === 'marker' && plan.markers.length > 1
        ? <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemoveMarker(r.idx)} /> : null),
    },
  ], [po, plan.allowancePct, plan.markers.length, pcsOf, onPatchMarker, onRemoveMarker]);

  const detailRow = useCallback((r) => (
    <Space size="middle" wrap align="end" style={{ padding: '4px 8px' }}>
      <div>
        <FieldLabel>Marker Length (m)</FieldLabel>
        <InputNumber size="small" min={0.5} step={0.1} value={r.markerLength} style={{ width: 90 }}
          onChange={(v) => onPatchMarker(r.idx, { markerLength: v })} />
      </div>
      <div>
        <FieldLabel>Efficiency % (target ≥ {efficiencyTarget})</FieldLabel>
        <Space size={6}>
          <InputNumber size="small" min={40} max={99} value={r.efficiencyPct} style={{ width: 70 }}
            onChange={(v) => onPatchMarker(r.idx, { efficiencyPct: v })} />
          {r.efficiencyPct != null && (r.efficiencyPct >= efficiencyTarget
            ? <Tag color="green">On target</Tag> : <Tag color="orange">Below {efficiencyTarget}%</Tag>)}
        </Space>
      </div>
      <div>
        <FieldLabel>Lay Plan Dt</FieldLabel>
        <DatePicker size="small" format="DD-MMM" value={r.layPlanDate ? dayjs(r.layPlanDate) : null}
          onChange={(d) => onPatchMarker(r.idx, { layPlanDate: d ? d.format('YYYY-MM-DD') : null })} style={{ width: 100 }} />
      </div>
      <div>
        <FieldLabel>Cut Plan Dt</FieldLabel>
        <DatePicker size="small" format="DD-MMM" value={r.cutPlanDate ? dayjs(r.cutPlanDate) : null}
          onChange={(d) => onPatchMarker(r.idx, { cutPlanDate: d ? d.format('YYYY-MM-DD') : null })} style={{ width: 100 }} />
      </div>
      <div>
        <FieldLabel>Lay Table</FieldLabel>
        <FormSelect size="small" value={r.cuttingTableId} style={{ width: 120 }} placeholder="Table"
          options={tableOptions} onChange={(v) => onPatchMarker(r.idx, { cuttingTableId: v })} />
      </div>
      <div>
        <FieldLabel>CAD File</FieldLabel>
        <Input size="small" value={r.cadFile} placeholder="e.g. HM-TS-2601-M1.cut" style={{ width: 190 }}
          onChange={(e) => onPatchMarker(r.idx, { cadFile: e.target.value })} />
      </div>
    </Space>
  ), [onPatchMarker, tableOptions, efficiencyTarget]);

  return (
    <Card
      title="Markers — Size / Ratio Matrix"
      size="small"
      style={{ marginBottom: 16 }}
      extra={(
        <Space>
          <Button size="small" icon={<FileExcelOutlined />} onClick={onImportExcel}>Import CAD Marker Excel</Button>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAddMarker}>Add Marker</Button>
        </Space>
      )}
    >
      <Table
        rowKey={(r) => (r.type === 'marker' ? `m-${r.idx}` : r.type)}
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 780 }}
        expandable={{
          rowExpandable: (r) => r.type === 'marker',
          expandedRowRender: detailRow,
          columnWidth: 36,
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={2}><strong>TOTAL (all markers)</strong></Table.Summary.Cell>
              {(po?.sizes || []).map((sz, i) => {
                const over = totals.perSize[sz] > allowanceQty(po.sizeQty[sz], plan.allowancePct);
                return (
                  <Table.Summary.Cell key={sz} index={i + 2} align="center">
                    <strong style={{ color: over ? 'var(--error-color)' : undefined }}>{totals.perSize[sz]}</strong>
                  </Table.Summary.Cell>
                );
              })}
              <Table.Summary.Cell index={98} />
              <Table.Summary.Cell index={99} align="right"><strong>{totals.grand}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={100} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        One row per marker, exactly like the CAD marker sheet — H = height; Pcs/Mkr = garments per marker (e.g. 100=10).
        Expand a row for length, efficiency, lay/cut dates and table. Totals turn red where cutting exceeds the +{plan.allowancePct || 0}% allowance.
      </div>
    </Card>
  );
};

export default MarkerMatrix;
