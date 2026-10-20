import { memo, useState } from 'react';
import { Button, InputNumber, Popconfirm, Select, Space, Typography } from 'antd';
import { BULK_MODE, bulkTargets, bulkImpact, applyRate, lastRateTargets, applyLastRates } from '../../../utils/jobWorkBulkFill';
import { numericInputProps } from '../../../utils/inputHelpers';
import { afterPaint } from '../../../hooks/usePaintedWork';

const { Text } = Typography;
const MODES = [
  { value: BULK_MODE.COLOUR, label: 'All sizes of a colour' },
  { value: BULK_MODE.SIZE, label: 'All colours of a size' },
  { value: BULK_MODE.ALL, label: 'All lines' },
  { value: BULK_MODE.SELECTED, label: 'Selected lines' },
];

/**
 * Rate bulk fill in a job-work PO grid header (CPP FR-15, §18.2): says how many lines it sets
 * — and how many already carry a rate — before applying. `colourKey` is the lines' colour
 * field, `precision` the rate's decimals (2 on a Cut Panel PO, 4 on a Garment Process PO),
 * `rateOf(line)` the vendor's last rate for a line; `recent` the last three rates (§20).
 * Each Popconfirm's OK spins (its returned promise) until the re-rated grid has rendered.
 * `mode` / `onMode` are the grid's (BULK_MODE): it shows its tick boxes only on "Selected lines", the one mode
 * they serve, and keeps the mode while the bar is away (an emptied grid).
 */
const JobWorkBulkFillBar = memo(function JobWorkBulkFillBar({ lines, selectedKeys, colourKey = 'colorName', precision = 2, rateOf, recent, onApply, mode, onMode }) {
  const [target, setTarget] = useState(undefined);
  const [rate, setRate] = useState(null);
  const colours = [...new Set(lines.map((l) => l[colourKey]))];
  const sizes = [...new Set(lines.map((l) => l.size))];
  const needsTarget = mode === BULK_MODE.COLOUR || mode === BULK_MODE.SIZE;
  const keys = bulkTargets(lines, mode, target, selectedKeys, colourKey);
  const impact = bulkImpact(lines, keys);
  const lastKeys = lastRateTargets(lines, rateOf);
  const lastImpact = bulkImpact(lines, lastKeys);
  return (
    <Space wrap size={8}>
      <Select size="small" name="bulkMode" aria-label="Fill rate for" style={{ width: 170 }} options={MODES} value={mode} onChange={(m) => { onMode(m); setTarget(undefined); }} />
      {needsTarget && (
        <Select size="small" name="bulkTarget" aria-label={mode === BULK_MODE.COLOUR ? 'Colour' : 'Size'} style={{ width: 130 }}
          placeholder={mode === BULK_MODE.COLOUR ? 'Colour' : 'Size'} value={target}
          options={(mode === BULK_MODE.COLOUR ? colours : sizes).map((v) => ({ value: v, label: v }))} onChange={setTarget} />
      )}
      <InputNumber size="small" name="bulkRate" aria-label="Rate to fill" min={0} precision={precision} controls={false} prefix="₹" style={{ width: precision > 2 ? 120 : 100 }}
        value={rate} onChange={setRate} {...numericInputProps} />
      <Popconfirm
        title={`Set ₹${rate ?? 0} on ${impact.count} line${impact.count === 1 ? '' : 's'}?`}
        description={impact.overwrites ? `${impact.overwrites} already carry a rate and will be overwritten.` : 'No existing rate is overwritten.'}
        okText="Apply" onConfirm={() => afterPaint().then(() => onApply(applyRate(lines, keys, rate)))} disabled={!impact.count || rate == null}
      >
        <Button size="small" disabled={!impact.count || rate == null}>Apply to {impact.count}</Button>
      </Popconfirm>
      <Popconfirm
        title={`Copy the last PO rate onto ${lastImpact.count} line${lastImpact.count === 1 ? '' : 's'}?`}
        description={lastImpact.overwrites ? `${lastImpact.overwrites} already carry a rate and will be overwritten.` : undefined}
        okText="Copy" onConfirm={() => afterPaint().then(() => onApply(applyLastRates(lines, rateOf)))} disabled={!lastImpact.count}
      >
        <Button size="small" disabled={!lastImpact.count}>Copy last PO rates</Button>
      </Popconfirm>
      {recent?.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Last rates: {recent.map((r) => `₹${Number(r.rate).toFixed(precision)} (${r.poNo})`).join(' · ')}
        </Text>
      )}
    </Space>
  );
});

export default JobWorkBulkFillBar;
