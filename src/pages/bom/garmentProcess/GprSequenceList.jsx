import { memo } from 'react';
import { Button, Card, Popconfirm, Space, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { gprFlowLabel, gprLineLabel, gprLineTotals } from '../../../utils/garmentProcessCalc';

const { Text } = Typography;

/**
 * B (left). Process sequence list (PRD §8): Seq is automatic 1..n; ↑ ↓ swap with the
 * neighbour, ✕ deletes after confirmation, "+ Add process" appends a line with every
 * colour and size selected. The flow line joins the process names in sequence.
 */
const GprSequenceList = memo(function GprSequenceList({ lines, order, activeKey, editable, allProcessesUsed, onSelect, onMove, onRemove, onAdd }) {
  return (
    <Card title="Processes" size="small" style={{ marginBottom: 16 }}>
      <div role="listbox" aria-label="Process lines" style={{ display: 'grid', gap: 6 }}>
        {lines.map((l, i) => {
          const label = gprLineLabel(l);
          const active = l.key === activeKey;
          return (
            <div
              key={l.key}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onSelect(l.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(l.key); } }}
              style={{
                padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-color, #f0f0f0)'}`,
                background: active ? 'color-mix(in srgb, var(--primary-color) 6%, transparent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span>
                  <Text strong>Seq {l.seqNo}</Text>{' '}
                  {label ? <Text>{label}</Text> : <Text type="danger">Select a process</Text>}
                </span>
                {editable && (
                  <Space size={0} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Move up"><Button type="text" size="small" icon={<ArrowUpOutlined />} aria-label={`Move Seq ${l.seqNo} up`} disabled={i === 0} onClick={() => onMove(l.key, -1)} /></Tooltip>
                    <Tooltip title="Move down"><Button type="text" size="small" icon={<ArrowDownOutlined />} aria-label={`Move Seq ${l.seqNo} down`} disabled={i === lines.length - 1} onClick={() => onMove(l.key, 1)} /></Tooltip>
                    <Popconfirm title={`Delete Seq ${l.seqNo}?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onRemove(l.key)}>
                      <Button type="text" size="small" danger icon={<CloseOutlined />} aria-label={`Delete Seq ${l.seqNo}`} />
                    </Popconfirm>
                  </Space>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {l.colors.join(', ') || 'No colour'} · {l.sizes.length} size(s) · {gprLineTotals(l, order).total.toLocaleString('en-IN')} pcs
              </Text>
            </div>
          );
        })}
      </div>
      {editable && (
        <Tooltip title={allProcessesUsed ? 'Every active garment process is already on this requirement' : undefined}>
          <Button type="dashed" block icon={<PlusOutlined />} onClick={onAdd} disabled={allProcessesUsed} style={{ marginTop: 8 }}>Add process</Button>
        </Tooltip>
      )}
      {gprFlowLabel(lines) && (
        <div style={{ marginTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Flow</Text>
          <div><Text strong>{gprFlowLabel(lines)}</Text></div>
        </div>
      )}
    </Card>
  );
});

export default GprSequenceList;
