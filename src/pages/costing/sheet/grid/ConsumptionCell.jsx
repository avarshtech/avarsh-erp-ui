import { Button, InputNumber, Tooltip } from 'antd';
import { CalculatorOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';

/**
 * Quantity per garment, in the item's consumption unit. Fabric rows carry the calculators:
 * knits parts (Knits), woven marker (Woven) and the AI measurement-chart reader (either).
 */
export default function ConsumptionCell({ sectionKey, spec, record }) {
  const { dispatch, openDialog } = useSheet();
  const update = (value) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch: { consumption: value } });
  const calculators = spec.calculators;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <InputNumber
        name="consumption" value={record.consumption} min={0} step={0.01} controls={false} placeholder="Qty"
        size="small" style={{ flex: 1, minWidth: 0 }} suffix={record.uom ? record.uom.toUpperCase() : undefined}
        onChange={update} {...numericInputProps}
      />
      {calculators && record.classification === 'Knits' && (
        <Tooltip title="Knits consumption calculator (parts)">
          <Button size="small" type="text" icon={<CalculatorOutlined />} aria-label="Knits consumption calculator"
            onClick={() => openDialog('knits', { rowKey: record.key })} />
        </Tooltip>
      )}
      {calculators && record.classification === 'Woven' && (
        <Tooltip title="Woven consumption calculator">
          <Button size="small" type="text" icon={<CalculatorOutlined />} aria-label="Woven consumption calculator"
            onClick={() => openDialog('woven', { rowKey: record.key })} />
        </Tooltip>
      )}
      {calculators && (
        <Tooltip title="Calculate from a measurement chart (AI)">
          <Button size="small" type="text" icon={<ThunderboltOutlined />} aria-label="AI consumption calculator"
            style={{ color: 'var(--warning-color)' }} onClick={() => openDialog('aiConsumption', { rowKey: record.key })} />
        </Tooltip>
      )}
    </div>
  );
}
