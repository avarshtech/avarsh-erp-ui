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
      <ul aria-label="Process lines" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {lines.map((l, i) => {
          const label = gprLineLabel(l);
          const active = l.key === activeKey;
          const detail = `${l.colors.join(', ') || 'No colour'} · ${l.sizes.length} size(s) · ${gprLineTotals(l, order).total.toLocaleString('en-IN')} pcs`;
          return (
            <li
              key={l.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 6,
                border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-color, #f0f0f0)'}`,
                background: active ? 'color-mix(in srgb, var(--primary-color) 6%, transparent)' : undefined,
              }}
            >
              {/* The line opens in the editor; its move / delete buttons are siblings, never nested in it. */}
              <div
                role="button"
                tabIndex={0}
                aria-current={active ? 'true' : undefined}
                aria-label={`Seq ${l.seqNo} ${label || 'no process yet'}: ${detail}`}
                onClick={() => onSelect(l.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(l.key); } }}
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              >
                <div>
                  <Text strong>Seq {l.seqNo}</Text>{' '}
                  {label ? <Text>{label}</Text> : <Text type="danger">Select a process</Text>}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{detail}</Text>
              </div>
              {editable && (
                <Space size={0}>
                  <Tooltip title="Move up"><Button type="text" size="small" icon={<ArrowUpOutlined />} aria-label={`Move Seq ${l.seqNo} up`} disabled={i === 0} onClick={() => onMove(l.key, -1)} /></Tooltip>
                  <Tooltip title="Move down"><Button type="text" size="small" icon={<ArrowDownOutlined />} aria-label={`Move Seq ${l.seqNo} down`} disabled={i === lines.length - 1} onClick={() => onMove(l.key, 1)} /></Tooltip>
                  <Popconfirm title={`Delete Seq ${l.seqNo}?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onRemove(l.key)}>
                    <Button type="text" size="small" danger icon={<CloseOutlined />} aria-label={`Delete Seq ${l.seqNo}`} />
                  </Popconfirm>
                </Space>
              )}
            </li>
          );
        })}
      </ul>
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
