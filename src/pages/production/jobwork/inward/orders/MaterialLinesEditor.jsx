import { memo } from 'react';
import {
  Button, Input, InputNumber, Segmented, Select, Table,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  MATERIAL_KIND, MATERIAL_KIND_LABEL, SUPPLIED_BY, SUPPLIED_BY_LABEL, toOptions,
} from '../../../../../utils/jobWorkInward/inwardConstants';

const UOMS = ['kg', 'm', 'pcs', 'sets', 'cone'].map((u) => ({ value: u, label: u }));
const SUPPLIERS = [{ value: SUPPLIED_BY.PRINCIPAL, label: SUPPLIED_BY_LABEL.PRINCIPAL }, { value: SUPPLIED_BY.OWN, label: 'We buy' }];

/** The order's material lines with "Supplied by" — the BOM column a job-work order adds (no purchase PO for the principal's lines). */
const MaterialLinesEditor = memo(function MaterialLinesEditor({ lines, colours, onChange }) {
  const patch = (i, p) => onChange(lines.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const colourOptions = [{ value: '', label: 'All colours' }, ...colours.filter((c) => c.trim()).map((c) => ({ value: c, label: c }))];
  const columns = [
    { title: 'Kind', key: 'kind', width: 120, render: (_, m, i) => <Select name={`mat-kind-${i}`} size="small" style={{ width: '100%' }} value={m.kind} options={toOptions(MATERIAL_KIND_LABEL)} onChange={(v) => patch(i, { kind: v })} /> },
    { title: 'Material', key: 'name', width: 220, render: (_, m, i) => <Input name={`mat-name-${i}`} size="small" value={m.itemName} onChange={(e) => patch(i, { itemName: e.target.value })} /> },
    { title: 'Colour', key: 'colour', width: 130, render: (_, m, i) => <Select name={`mat-colour-${i}`} size="small" style={{ width: '100%' }} value={m.colour || ''} options={colourOptions} onChange={(v) => patch(i, { colour: v || null })} /> },
    { title: 'Unit', key: 'uom', width: 85, render: (_, m, i) => <Select name={`mat-uom-${i}`} size="small" style={{ width: '100%' }} value={m.uom} options={UOMS} onChange={(v) => patch(i, { uom: v })} /> },
    { title: 'Per piece', key: 'cons', width: 95, render: (_, m, i) => <InputNumber name={`mat-cons-${i}`} size="small" min={0} step={0.01} controls={false} style={{ width: '100%' }} value={m.consumption} onChange={(v) => patch(i, { consumption: v })} /> },
    { title: 'Allow. %', key: 'allow', width: 80, render: (_, m, i) => <InputNumber name={`mat-allow-${i}`} size="small" min={0} max={20} controls={false} style={{ width: '100%' }} value={m.allowancePct} onChange={(v) => patch(i, { allowancePct: v ?? 0 })} /> },
    { title: 'Supplied by', key: 'by', width: 180, render: (_, m, i) => <Segmented size="small" value={m.suppliedBy} options={SUPPLIERS} onChange={(v) => patch(i, { suppliedBy: v })} /> },
    { title: '', key: 'x', width: 44, render: (_, m, i) => <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove line" onClick={() => onChange(lines.filter((_, j) => j !== i))} /> },
  ];
  return (
    <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={lines} scroll={{ x: 960 }}
      footer={() => (
        <Button size="small" icon={<PlusOutlined />} onClick={() => onChange([...lines, { key: `m${Date.now()}`, kind: MATERIAL_KIND.TRIM, itemName: '', colour: null, uom: 'pcs', consumption: 1, allowancePct: 2, suppliedBy: SUPPLIED_BY.PRINCIPAL }])}>Add line</Button>
      )} />
  );
});

export default MaterialLinesEditor;
