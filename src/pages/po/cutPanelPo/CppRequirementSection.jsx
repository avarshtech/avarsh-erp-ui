import { memo, useMemo } from 'react';
import { Alert, Button, Card, Col, Row, Select, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import CppRequirementLookup from './CppRequirementLookup';
import CppProcessSteps from './CppProcessSteps';

const { Text } = Typography;

/**
 * ② Panel Process & Approved Requirement (PRD §8.2): one process per PO, chosen first and
 * locked once lines exist (FR-06, BR-03); the requirement lookup, colour and size filters
 * (default all) and Add to Grid, which appends and never clears (FR-12). The process-step
 * table shows which steps of these requirements other POs already cover (§13.2).
 */
const CppRequirementSection = memo(function CppRequirementSection({
  doc, editable, lookup, selection, onProcess, onSelection, onAdd, adding, masterNote,
}) {
  const label = doc.process?.label ?? doc.process?.name;
  const locked = doc.lines.length > 0;
  const picked = useMemo(() => lookup.cprs.filter((c) => selection.cprIds.includes(c.id)), [lookup.cprs, selection.cprIds]);
  const colours = [...new Set(picked.flatMap((c) => c.colours))];
  const sizes = [...new Set(picked.flatMap((c) => c.sizes))];
  const processOptions = lookup.processes.map((p) => ({
    value: p.label, label: `${p.label} — ${p.cprCount} requirement${p.cprCount === 1 ? '' : 's'} with balance`, option: p,
  }));
  const cprIds = [...new Set(doc.lines.map((l) => l.cprId))];

  return (
    <Card id="cpp-requirement" size="small" title="② Panel Process & Requirement" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]} align="bottom">
        <Col xs={24} md={10}>
          <Text type="secondary" style={{ fontSize: 12 }}>Panel process — one per PO</Text>
          <Select
            id="cpp-process" showSearch style={{ width: '100%' }} placeholder="Choose the panel process first"
            disabled={!editable || locked} value={label ?? undefined} options={processOptions}
            onChange={(v) => onProcess(processOptions.find((o) => o.value === v).option)}
          />
        </Col>
        {locked && <Col xs={24} md={14}><Text type="secondary">Locked: the PO has lines for {label}. A different process needs its own PO.</Text></Col>}
      </Row>
      {masterNote && <Alert type="warning" showIcon title={masterNote} style={{ marginTop: 12 }} />}
      {editable && label && (
        <>
          <div style={{ marginTop: 12 }}>
            <CppRequirementLookup rows={lookup.cprs} loading={lookup.loading} selectedIds={selection.cprIds} onSelect={(ids) => onSelection({ cprIds: ids })} />
          </div>
          <Space wrap style={{ marginTop: 12 }}>
            <Select mode="multiple" name="cpp-colours" aria-label="Colours" style={{ minWidth: 220 }} placeholder="All colours"
              options={colours.map((c) => ({ value: c, label: c }))} value={selection.colours} onChange={(v) => onSelection({ colours: v })} />
            <Select mode="multiple" name="cpp-sizes" aria-label="Sizes" style={{ minWidth: 200 }} placeholder="All sizes"
              options={sizes.map((s) => ({ value: s, label: s }))} value={selection.sizes} onChange={(v) => onSelection({ sizes: v })} />
            <Button type="primary" icon={<PlusOutlined />} disabled={!selection.cprIds.length} loading={adding} onClick={onAdd}>Add to Grid</Button>
          </Space>
        </>
      )}
      {cprIds.length > 0 && <CppProcessSteps cprIds={cprIds} processLabel={label} />}
    </Card>
  );
});

export default CppRequirementSection;
