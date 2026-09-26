import { memo, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { CPR_VAL, EXPANSION_WARN_LIMIT, OTHER_PROCESS_NAME } from '../../../utils/cutPanelConstants';
import ProcessChips from './ProcessChips';
import {
  ALL_COLOURS, fabricOptions, renderFabricOption, colourOptions, renderColourOption,
  panelOptions, processOptions, renderProcessOption,
} from './cprSelectionOptions';

const EMPTY = { fabricId: undefined, colors: [], panelIds: [], processIds: [], otherName: '' };

/**
 * Section 2 — Cut Panel Selection (PRD §8.2). One combined selection; "+ Add to Grid"
 * expands it into Colours x Panels x Processes lines. `onAdd(selection)` returns
 * { added, skipped }. Masters come from the real Processes / Parts APIs.
 */
const CprSelectionStrip = memo(function CprSelectionStrip({ order, fabrics, processes, parts, masters, defaultAllowance, onAdd }) {
  const { message, modal } = App.useApp();
  const [sel, setSel] = useState(EMPTY);
  const [allowance, setAllowance] = useState(defaultAllowance);
  const set = (patch) => setSel((s) => ({ ...s, ...patch }));

  const fabric = fabrics.find((f) => f.id === sel.fabricId);
  const chosenProcesses = useMemo(() => sel.processIds.map((id) => processes.find((p) => p.id === id)).filter(Boolean), [sel.processIds, processes]);
  const needsOther = chosenProcesses.some((p) => p.processName === OTHER_PROCESS_NAME);

  const onColours = (vals) => set({ colors: vals.includes(ALL_COLOURS) ? (fabric?.colors || []) : vals });
  const reset = () => { setSel(EMPTY); setAllowance(defaultAllowance); };

  const add = () => {
    if (!fabric || !sel.colors.length || !sel.panelIds.length || !chosenProcesses.length) { message.warning(CPR_VAL.VAL_03); return; }
    if (needsOther && !sel.otherName.trim()) { message.warning(CPR_VAL.OTHER_NAME); return; }
    if (allowance == null || allowance < 0) { message.warning(CPR_VAL.VAL_07); return; }
    const go = () => {
      const { added, skipped } = onAdd({
        fabric,
        colorNames: sel.colors,
        panels: sel.panelIds.map((id) => parts.find((p) => p.id === id)).filter(Boolean),
        processes: chosenProcesses.map((p) => ({ ...p, otherName: p.processName === OTHER_PROCESS_NAME ? sel.otherName.trim() : null })),
        allowancePct: allowance,
      });
      if (added) message.success(`${added} line(s) added to the grid`);
      if (skipped) message.warning(`${skipped} line(s) already exist and were skipped`);
    };
    const count = sel.colors.length * sel.panelIds.length * chosenProcesses.length;
    if (count <= EXPANSION_WARN_LIMIT) { go(); return; }
    modal.confirm({ title: `This adds ${count} lines`, content: 'That is more than 200 lines in one step. Continue?', okText: 'Add lines', onOk: go });
  };

  if (masters.forbidden) {
    return <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="You need view access to Processes and Parts (Master Data) to add cut panel lines." />;
  }

  return (
    <Card title="Cut Panel Selection" size="small" style={{ marginBottom: 16 }}>
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} md={12} xl={5}>
            <Form.Item label="Fabric" htmlFor="cpr-fabric">
              <Select id="cpr-fabric" showSearch optionFilterProp="label" placeholder="Fabric from the BOM" value={sel.fabricId}
                options={fabricOptions(fabrics)} optionRender={renderFabricOption}
                onChange={(fabricId) => set({ fabricId, colors: [] })} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Form.Item label="Colours" htmlFor="cpr-colours">
              <Select id="cpr-colours" mode="multiple" placeholder={fabric ? 'Colours' : 'Pick a fabric first'} disabled={!fabric}
                value={sel.colors} options={colourOptions(order, fabric)} optionRender={renderColourOption}
                onChange={onColours} maxTagCount="responsive" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Form.Item label="Panel" htmlFor="cpr-panels">
              <Select id="cpr-panels" mode="multiple" showSearch optionFilterProp="label" loading={masters.loading}
                placeholder="Panels (Parts master)" value={sel.panelIds} options={panelOptions(parts)}
                onChange={(panelIds) => set({ panelIds })} maxTagCount="responsive"
                notFoundContent={masters.loading ? 'Loading…' : 'No active parts — add them in Master Data › Parts'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12} xl={5}>
            <Form.Item label="Panel Process (in sequence)" htmlFor="cpr-processes">
              <Select id="cpr-processes" mode="multiple" showSearch optionFilterProp="label" loading={masters.loading}
                placeholder="Tick in the order they happen" value={sel.processIds} options={processOptions(processes)}
                optionRender={renderProcessOption(sel.processIds)} onChange={(processIds) => set({ processIds })}
                maxTagCount={0} maxTagPlaceholder={(omitted) => `${omitted.length} selected`}
                notFoundContent={masters.loading ? 'Loading…' : "No active 'Cut Panel' processes — add them in Master Data › Processes"} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6} xl={2}>
            <Form.Item label="Allowance %" htmlFor="cpr-allowance">
              <InputNumber id="cpr-allowance" min={0} max={100} precision={2} value={allowance} onChange={setAllowance} suffix="%" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6} xl={2}>
            <Form.Item label=" ">
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={add}>Add to Grid</Button>
                <Button icon={<UndoOutlined />} onClick={reset} aria-label="Reset selection" />
              </Space>
            </Form.Item>
          </Col>
        </Row>
        {needsOther && (
          <Form.Item label="Name the “Other” process" required htmlFor="cpr-other" style={{ maxWidth: 360 }}>
            <Input id="cpr-other" maxLength={100} value={sel.otherName} onChange={(e) => set({ otherName: e.target.value })} placeholder="e.g. Rhinestone setting" />
          </Form.Item>
        )}
      </Form>
      <ProcessChips
        items={chosenProcesses.map((p) => ({ id: p.id, label: p.processName === OTHER_PROCESS_NAME && sel.otherName ? sel.otherName : p.processName }))}
        onReorder={(processIds) => set({ processIds })}
        onRemove={(id) => set({ processIds: sel.processIds.filter((x) => x !== id) })}
      />
    </Card>
  );
});

export default CprSelectionStrip;
