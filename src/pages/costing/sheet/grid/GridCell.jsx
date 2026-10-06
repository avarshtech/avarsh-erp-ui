import { Input, InputNumber, Select, Typography } from 'antd';
import { formatCurrency } from '../../../../utils/costingConstants';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';
import MasterCell from './MasterCell';
import ConsumptionCell from './ConsumptionCell';
import RateCell from './RateCell';
import VendorCell from './VendorCell';

/** Renders one cell of a section grid from its column spec (see model/sectionConfig.js). */
export default function GridCell({ sectionKey, spec, record }) {
  const { dispatch, header } = useSheet();
  const update = (value) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch: { [spec.field]: value } });
  const value = record[spec.field];

  switch (spec.type) {
    case 'master':
      return <MasterCell sectionKey={sectionKey} record={record} />;
    case 'consumption':
      return <ConsumptionCell sectionKey={sectionKey} spec={spec} record={record} />;
    case 'rate':
      return <RateCell sectionKey={sectionKey} spec={spec} record={record} />;
    case 'vendor':
      return <VendorCell sectionKey={sectionKey} spec={spec} record={record} />;
    case 'amount':
      return (
        <Typography.Text strong style={{ color: 'var(--success-color)' }}>
          {formatCurrency(value, spec.currency === 'USD' ? 'USD' : header.currency)}
        </Typography.Text>
      );
    case 'pct':
      return (
        <InputNumber name={spec.field} value={value} min={0} max={100} controls={false} placeholder="%"
          size="small" style={{ width: '100%' }} onChange={update} {...numericInputProps} />
      );
    case 'money':
      return (
        <InputNumber name={spec.field} value={value} min={0} step={0.01} controls={false} placeholder="Cost"
          size="small" style={{ width: '100%' }} onChange={update} {...numericInputProps} />
      );
    case 'select':
      return <Select value={value} options={spec.options} size="small" style={{ width: '100%' }} onChange={update} aria-label={spec.title} />;
    default:
      return (
        <Input name={spec.field} value={value} placeholder={spec.placeholder} size="small" maxLength={500}
          onChange={(e) => update(e.target.value)} />
      );
  }
}
