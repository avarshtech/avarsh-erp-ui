import { Button, Input, InputNumber, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import ColorDot from '../shared/ColorDot';
import { lineTotal, needsReason, processLabel, varianceOf } from '../../../utils/cutPanelCalc';
import { CPR_WRN } from '../../../utils/cutPanelConstants';
import { QtyInput, SeqInput } from './CprGridInputs';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

const span = (row, full, refSpan) => {
  if (row.type === 'group') return { colSpan: full };
  if (row.type === 'ref') return { colSpan: refSpan };
  return {};
};
const hideOn = (...types) => (row) => (types.includes(row.type) ? { colSpan: 0 } : {});

export const buildGridColumns = ({ order, editable, orderAllowancePct, handlers, collapsed, focusNext }) => {
  const sizes = order.sizes;
  const fullSpan = 7 + sizes.length;

  return [
    {
      title: 'Panel', key: 'panel', width: 150, fixed: 'left',
      onCell: (row) => span(row, fullSpan, 4),
      render: (_, row) => {
        if (row.type === 'group') {
          const open = !collapsed.has(row.gk);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button type="text" size="small" icon={open ? <DownOutlined /> : <RightOutlined />} aria-label={open ? 'Collapse group' : 'Expand group'} onClick={() => handlers.toggleGroup(row.gk)} />
              <strong>{row.fabricName}</strong><Text type="secondary">{row.fabricCode}</Text>
              <ColorDot hex={row.color.hex} name={row.color.name} /><strong>{row.color.name}</strong>
              <Text type="secondary">Order {n(row.orderQty)} · incl. allowance {n(row.orderQtyAllow)} · {row.lineCount} line(s)</Text>
            </span>
          );
        }
        if (row.type === 'ref') return <Text type="secondary" style={{ fontSize: 12 }}>Order qty per size</Text>;
        return <span>{row.panelName} <Text type="secondary" style={{ fontSize: 11 }}>×{row.panelsPerGarment}</Text></span>;
      },
    },
    {
      title: 'Process', key: 'process', width: 170, onCell: hideOn('group', 'ref'),
      render: (_, row) => (row.type !== 'line' ? null : (
        <span>{processLabel(row)} {row.isManualOverride && <Tag color="warning" style={{ marginLeft: 4 }}>Edited</Tag>}</span>
      )),
    },
    {
      title: 'Seq', key: 'seq', width: 70, align: 'center', onCell: hideOn('group', 'ref'),
      render: (_, row) => (row.type !== 'line' ? null : editable
        ? <SeqInput key={`${row.key}:${row.sequenceNo}`} row={row} onSeq={handlers.onSeq} />
        : row.sequenceNo),
    },
    {
      title: 'Allow %', key: 'allow', width: 90, align: 'right', onCell: hideOn('group', 'ref'),
      render: (_, row) => (row.type !== 'line' ? null : editable
        ? <InputNumber size="small" name={`allow-${row.key}`} aria-label={`${processLabel(row)} allowance percent`} min={0} max={100} precision={2} controls={false} value={row.allowancePct} onChange={(v) => handlers.onAllow(row.key, v ?? 0)} style={{ width: 70 }} />
        : Number(row.allowancePct).toFixed(2)),
    },
    ...sizes.map((size, idx) => ({
      title: size, key: `size-${size}`, width: 90, align: 'right', onCell: hideOn('group'),
      // AntD still calls render for colSpan-0 cells, so every column guards its row type.
      render: (_, row) => {
        if (row.type === 'group') return null;
        return row.type === 'ref'
          ? <Text type="secondary">{n(row.base[size])}</Text>
          : <QtyInput row={row} size={size} idx={idx} editable={editable} onQty={handlers.onQty} focusNext={focusNext} />;
      },
    })),
    {
      title: 'Total', key: 'total', width: 90, align: 'right', onCell: hideOn('group'),
      render: (_, row) => {
        if (row.type === 'group') return null;
        return row.type === 'ref'
          ? <Text type="secondary">{n(Object.values(row.base).reduce((s, v) => s + (v || 0), 0))}</Text>
          : <strong>{n(lineTotal(row))}</strong>;
      },
    },
    {
      title: 'Reason', key: 'reason', width: 220, onCell: hideOn('group'),
      render: (_, row) => {
        if (row.type !== 'line' || !needsReason(row, orderAllowancePct)) return row.type === 'line' ? <Text type="secondary">—</Text> : null;
        const v = varianceOf(row);
        const why = [v > 0 && `${CPR_WRN.WRN_01} (+${n(v)})`, v < 0 && `${CPR_WRN.WRN_02} (${n(v)})`,
          Number(row.allowancePct) !== Number(orderAllowancePct) && CPR_WRN.WRN_04].filter(Boolean).join('; ');
        return editable
          ? <Tooltip title={why}><Input size="small" name={`reason-${row.key}`} aria-label={`Reason for ${processLabel(row)} variance`} placeholder="Reason required" status={row.varianceReason?.trim() ? undefined : 'warning'} value={row.varianceReason} maxLength={300} onChange={(e) => handlers.onReason(row.key, e.target.value)} /></Tooltip>
          : <Tooltip title={why}><Text>{row.varianceReason || '—'}</Text></Tooltip>;
      },
    },
    {
      title: '', key: 'remove', width: 50, fixed: 'right', onCell: hideOn('group'),
      render: (_, row) => (row.type === 'line' && editable
        ? <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`Remove ${processLabel(row)} line`} onClick={() => handlers.onRemove(row.key)} />
        : null),
    },
  ];
};
