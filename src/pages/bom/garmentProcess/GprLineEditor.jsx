import { memo, useMemo } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Typography } from 'antd';
import { CopyOutlined, UndoOutlined } from '@ant-design/icons';
import { gprLineLabel, gprLineTotals } from '../../../utils/garmentProcessCalc';
import { GPR_OTHER_PROCESS_NAME } from '../../../utils/garmentProcessConstants';
import GprChipPicker from './GprChipPicker';
import GprQtyGrid from './GprQtyGrid';
import GprOverQtyReasons from './GprOverQtyReasons';

const { Text } = Typography;

/**
 * B (right). Editor for the active process line (PRD §8–10): process (category Garment;
 * processes on other lines are disabled), colours and sizes, tools, the quantity grid,
 * the line total and any over-quantity reasons.
 */
const GprLineEditor = memo(function GprLineEditor({ line, lines, index, order, processes, masters, editable, canOverQty, on }) {
  const used = useMemo(() => new Set(lines.filter((l) => l.key !== line.key).map((l) => l.processName).filter(Boolean)), [lines, line.key]);
  const options = processes.map((p) => ({
    value: p.processName,
    label: used.has(p.processName) ? `${p.processName} (already added)` : p.processName,
    disabled: used.has(p.processName),
    id: p.id,
  }));
  const totals = gprLineTotals(line, order);

  return (
    <Card size="small" style={{ marginBottom: 16 }} title={`Seq ${line.seqNo} — ${gprLineLabel(line) || 'Select a process'}`}>
      {masters.forbidden && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="You need view access to Processes (Master Data) to pick a process." />}
      {masters.failed && <Alert type="error" showIcon style={{ marginBottom: 12 }} title="The Processes master could not be loaded — reload the page to pick a process." />}
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="Process" required htmlFor={`gpr-process-${line.key}`}>
              <Select id={`gpr-process-${line.key}`} showSearch optionFilterProp="label" placeholder="Garment process" disabled={!editable}
                loading={masters.loading} value={line.processName || undefined} options={options}
                notFoundContent={masters.loading ? 'Loading…' : "No active 'Garment' processes — add them in Master Data › Processes"}
                onChange={(name, opt) => on.patch({ processName: name, processId: opt?.id ?? null, processOtherName: null })} />
            </Form.Item>
          </Col>
          {line.processName === GPR_OTHER_PROCESS_NAME && (
            <Col xs={24} md={12}>
              <Form.Item label="Name the “Other” process" required htmlFor={`gpr-other-${line.key}`}>
                <Input id={`gpr-other-${line.key}`} maxLength={100} disabled={!editable} value={line.processOtherName || ''} onChange={(e) => on.patch({ processOtherName: e.target.value })} />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
      <GprChipPicker label="Colours" disabled={!editable} selected={line.colors} onChange={(colors) => on.patch({ colors })}
        items={order.colors.map((c) => ({ value: c.name, label: c.name, extra: c.qty.toLocaleString('en-IN') }))} />
      <GprChipPicker label="Sizes" disabled={!editable} selected={line.sizes} onChange={(sizes) => on.patch({ sizes })}
        items={order.sizes.map((s) => ({ value: s, label: s }))} />
      {editable && (
        <Space wrap style={{ marginBottom: 10 }}>
          <Button size="small" icon={<CopyOutlined />} disabled={index === 0} onClick={on.copyPrevious}>Copy from previous Seq</Button>
          <Button size="small" icon={<UndoOutlined />} onClick={on.resetQty}>Reset qty to order qty</Button>
        </Space>
      )}
      <GprQtyGrid line={line} order={order} editable={editable} onQty={on.qty} />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Text>Total process quantity <strong>{totals.total.toLocaleString('en-IN')}</strong></Text>{' '}
        <Text type="secondary">of {totals.orderQty.toLocaleString('en-IN')} order qty in selection</Text>
      </div>
      <GprOverQtyReasons line={line} order={order} editable={editable} canOverQty={canOverQty} onReason={on.reason} />
    </Card>
  );
});

export default GprLineEditor;
