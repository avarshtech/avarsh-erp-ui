import { memo, useState } from 'react';
import {
  Button, Card, Col, Input, InputNumber, Row, Space, Table, Tag, Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { challanShort } from '../../../../../utils/jobWorkInward/materialRules';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * One fabric line of the principal's challan, roll by roll (party roll numbers carry the Material In
 * number at posting). Short is judged against their challan, beyond their weight tolerance.
 */
const FabricRollsEditor = memo(function FabricRollsEditor({ material, value, tolerancePct, onChange }) {
  const [count, setCount] = useState(5);
  const rolls = value.rolls || [];
  const received = r1(rolls.reduce((a, r) => a + (Number(r.qty) || 0), 0));
  const short = challanShort({ kind: 'FABRIC', challanQty: value.challanQty, receivedQty: received, tolerancePct });
  const patchRoll = (i, p) => onChange({ ...value, rolls: rolls.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const addRolls = () => onChange({
    ...value,
    rolls: [...rolls, ...Array.from({ length: count }, (_, k) => ({ key: `r${Date.now()}-${k}`, rollNo: `R${String(rolls.length + k + 1).padStart(2, '0')}`, qty: null, width: rolls[0]?.width || '', gsm: rolls[0]?.gsm || null, shade: 'A' }))],
  });
  const cell = (k, r, i, props = {}) => (k === 'width' || k === 'shade' || k === 'rollNo'
    ? <Input name={`roll-${material.id}-${k}-${i}`} size="small" value={r[k]} onChange={(e) => patchRoll(i, { [k]: e.target.value })} {...props} />
    : <InputNumber name={`roll-${material.id}-${k}-${i}`} size="small" min={0} controls={false} style={{ width: '100%' }} value={r[k]} onChange={(v) => patchRoll(i, { [k]: v })} {...props} />);
  const columns = [
    { title: 'Roll', key: 'rollNo', width: 90, render: (_, r, i) => cell('rollNo', r, i) },
    { title: 'Kg', key: 'qty', width: 90, render: (_, r, i) => cell('qty', r, i) },
    { title: 'Width', key: 'width', width: 80, render: (_, r, i) => cell('width', r, i) },
    { title: 'GSM', key: 'gsm', width: 80, render: (_, r, i) => cell('gsm', r, i) },
    { title: 'Shade', key: 'shade', width: 70, render: (_, r, i) => cell('shade', r, i) },
    { title: '', key: 'x', width: 40, render: (_, r, i) => <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove roll" onClick={() => onChange({ ...value, rolls: rolls.filter((_, j) => j !== i) })} /> },
  ];
  return (
    <Card size="small" style={{ marginBottom: 12 }}
      title={<Space wrap><Text strong>{material.itemName}</Text><Text type="secondary">needs {fmtQty(material.required)} kg · {fmtQty(material.received)} kg in so far</Text></Space>}
      extra={short > 0 ? <Tag color="orange">{fmtQty(short)} kg short on their challan</Tag> : null}>
      <Row gutter={12} style={{ marginBottom: 8 }}>
        <Col xs={12} md={6}><Text type="secondary" style={{ fontSize: 12 }}>Their challan (kg)</Text><InputNumber name={`fab-challan-${material.id}`} min={0} style={{ width: '100%' }} value={value.challanQty} onChange={(v) => onChange({ ...value, challanQty: v })} /></Col>
        <Col xs={12} md={6}><Text type="secondary" style={{ fontSize: 12 }}>Declared value (₹/kg)</Text><InputNumber name={`fab-rate-${material.id}`} min={0} style={{ width: '100%' }} value={value.declaredRate} onChange={(v) => onChange({ ...value, declaredRate: v })} /></Col>
        <Col xs={24} md={12} style={{ textAlign: 'right', alignSelf: 'end' }}>
          <Space><InputNumber name={`fab-count-${material.id}`} min={1} max={60} value={count} onChange={(v) => setCount(v || 1)} style={{ width: 70 }} /><Button icon={<PlusOutlined />} onClick={addRolls}>Add rolls</Button></Space>
        </Col>
      </Row>
      <Table rowKey="key" size="small" pagination={false} columns={columns} dataSource={rolls} scroll={{ y: 220 }}
        locale={{ emptyText: 'Add the rolls as they are weighed.' }}
        footer={() => <Text>{rolls.length} rolls · <Text strong>{fmtQty(received)} kg</Text> received{value.challanQty ? ` against ${fmtQty(value.challanQty)} kg on their challan` : ''}</Text>} />
    </Card>
  );
});

export default FabricRollsEditor;
