import { memo } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { OTHER_PROCESS_NAME } from '../../../utils/cutPanelConstants';
import ProcessChips from './ProcessChips';
import useCprSelection from './useCprSelection';
import {
  fabricOptions, renderFabricOption, colourOptions, renderColourOption,
  panelOptions, processOptions, renderProcessOption,
} from './cprSelectionOptions';

/**
 * Section 2 — Cut Panel Selection (PRD §8.2). One combined selection; "+ Add to Grid"
 * expands it into Colours x Panels x Processes lines. `onAdd(selection)` returns
 * { added, skipped }. Masters come from the real Processes / Parts APIs.
 */
const CprSelectionStrip = memo(function CprSelectionStrip({ order, fabrics, processes, parts, masters, defaultAllowance, onAdd }) {
  const {
    sel, set, allowance, setAllowance, fabric, chosenProcesses, needsOther, onColours, reset, add,
  } = useCprSelection({ order, fabrics, processes, parts, defaultAllowance, onAdd });

  if (masters.forbidden || masters.failed) {
    return masters.forbidden
      ? <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="You need view access to Processes and Parts (Master Data) to add cut panel lines." />
      : <Alert type="error" showIcon style={{ marginBottom: 16 }} title="The Processes and Parts masters could not be loaded — reload the page to add cut panel lines." />;
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
