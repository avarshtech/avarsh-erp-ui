import { memo } from 'react';
import { Alert, Input, Typography } from 'antd';
import { cellKey, overQtyCells } from '../../../utils/garmentProcessCalc';

const { Text } = Typography;

/**
 * Cells above their order qty (PRD §10, V7). Save draft is allowed; Submit needs the
 * "Submit above order qty" permission and a reason per cell — entered inline, no popup.
 */
const GprOverQtyReasons = memo(function GprOverQtyReasons({ line, order, editable, canOverQty, onReason }) {
  const cells = overQtyCells(line, order);
  if (!cells.length) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 12 }}
      title={`${cells.length} cell(s) above the order quantity`}
      description={canOverQty ? (
        <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
          {cells.map(({ color, size }) => {
            const key = cellKey(color, size);
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 8, alignItems: 'center' }}>
                <Text>{color} {size}: {Number(line.qty[color]?.[size]).toLocaleString('en-IN')} of {Number(order.qtyMatrix[color]?.[size]).toLocaleString('en-IN')}</Text>
                {editable
                  ? <Input size="small" name={`over-${line.key}-${key}`} aria-label={`Reason for ${color} ${size} above order quantity`} maxLength={300}
                      placeholder="Reason (mandatory to submit)" value={line.overQtyReasons?.[key] || ''} onChange={(e) => onReason(key, e.target.value)} />
                  : <Text type="secondary">{line.overQtyReasons?.[key] || '—'}</Text>}
              </div>
            );
          })}
        </div>
      ) : 'Saving the draft is fine, but submitting needs the "Submit above order qty" permission. Lower these cells or ask a senior merchandiser to submit.'}
    />
  );
});

export default GprOverQtyReasons;
