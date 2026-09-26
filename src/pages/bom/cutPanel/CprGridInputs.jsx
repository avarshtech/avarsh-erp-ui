import { useState } from 'react';
import { InputNumber, Tooltip, Typography } from 'antd';
import { processLabel } from '../../../utils/cutPanelCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const EDITED = { background: 'color-mix(in srgb, var(--warning-color, #faad14) 18%, transparent)' };

/**
 * Seq of one line. It commits on blur or Enter: the grid sorts by sequence, so committing
 * per keystroke would move the row away from the caret mid-typing. Render it with a key
 * that includes the committed sequence, so a renumber resets the draft.
 */
export const SeqInput = ({ row, onSeq }) => {
  const [draft, setDraft] = useState(row.sequenceNo);
  const commit = () => {
    if (draft >= 1 && draft !== row.sequenceNo) onSeq(row.key, draft);
    else setDraft(row.sequenceNo);
  };
  return (
    <InputNumber
      size="small" name={`seq-${row.key}`} aria-label={`${processLabel(row)} sequence`} min={1} max={99} precision={0} controls={false}
      value={draft} onChange={setDraft} onBlur={commit} onPressEnter={commit} style={{ width: 52 }}
    />
  );
};

/** One size cell: N/A without an order qty, amber where it differs from the calculation. */
export const QtyInput = ({ row, size, idx, editable, onQty, focusNext }) => {
  const cell = row.sizes[size] || { baseQty: 0, calculatedQty: 0, requiredQty: 0 };
  if (!(cell.baseQty > 0)) return <Text type="secondary" style={{ fontSize: 12 }}>N/A</Text>;
  const differs = Number(cell.requiredQty) !== cell.calculatedQty;
  const tip = differs ? `Calculated ${n(cell.calculatedQty)}` : undefined;
  if (!editable) return <Tooltip title={tip}><span style={{ ...(differs && EDITED), padding: '0 4px' }}>{n(cell.requiredQty)}</span></Tooltip>;
  return (
    <Tooltip title={tip}>
      <InputNumber
        id={`cpr-qty-${row.key}-${idx}`} name={`qty-${row.key}-${size}`} size="small" min={0} precision={0} controls={false}
        aria-label={`${row.colorName} ${row.panelName} ${processLabel(row)} ${size} quantity`}
        value={cell.requiredQty} onChange={(v) => onQty(row.key, size, v)}
        onPressEnter={() => focusNext(row.key, idx)} style={{ width: 72, ...(differs && EDITED) }}
      />
    </Tooltip>
  );
};
