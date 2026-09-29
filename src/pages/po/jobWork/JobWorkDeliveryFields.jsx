import { memo } from 'react';
import { Col, Input, Row, Select, Typography } from 'antd';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import ReadOnlyField from './ReadOnlyField';
import { OWN_UNIT, returnUnitOptions, unitSnapshot } from '../../../utils/jobWorkDelivery';

const { Text } = Typography;
const Label = ({ htmlFor, children, required = true }) => (
  <label htmlFor={htmlFor}><Text type="secondary" style={{ fontSize: 12 }}>{children}{required && <Text type="danger"> *</Text>}</Text></label>
);

const unitNoteOf = (units) => {
  if (units.failed) return 'Units could not be loaded — picking one needs HR Masters (view) access.';
  return !units.loading && !units.list.length ? 'No active unit in this branch — add one in HR › Masters › Units.' : null;
};

/**
 * Delivery Instructions of a job-work PO: Return To (named when "Other"), the return unit
 * from the Unit master with its address as the delivery place, the expected delivery date
 * and the processing instructions. Ids are `${idPrefix}-…`, so a dialog can reuse the fields
 * beside the page's. `editable` = { place, date, instructions }; `onChange(patch)` gets one
 * group per call — place, date or instructions — so an open amendment can take the date alone.
 * `units` comes from useJobWorkUnits; `dateNote` = { type: 'error' | 'warning', text }.
 */
const JobWorkDeliveryFields = memo(function JobWorkDeliveryFields({
  value, dateKey, idPrefix, returnToOptions, units, editable, onChange, dateNote = null, minDate = null,
}) {
  const id = (field) => `${idPrefix}-${field}`;
  const pickUnit = (unitId) => { if (unitId !== OWN_UNIT) onChange(unitSnapshot(units.list.find((u) => u.id === unitId))); };
  const unitNote = editable.place ? unitNoteOf(units) : null;
  return (
    <Row gutter={[16, 12]}>
      <Col xs={24} md={8}>
        <Label htmlFor={id('returnTo')}>Return to</Label>
        <Select id={id('returnTo')} aria-label="Return to" style={{ width: '100%' }} disabled={!editable.place} options={returnToOptions}
          value={value.returnTo ?? undefined} onChange={(returnTo) => onChange({ returnTo })} />
        {value.returnTo === 'OTHER' && (
          <Input id={id('returnToOther')} aria-label="Return to (other)" style={{ marginTop: 6 }} disabled={!editable.place} maxLength={200}
            placeholder="Where do the goods return to?" value={value.returnToOther ?? ''} onChange={(e) => onChange({ returnToOther: e.target.value })} />
        )}
      </Col>
      <Col xs={24} md={8}>
        <Label htmlFor={id('returnUnit')}>Return unit</Label>
        <Select id={id('returnUnit')} aria-label="Return unit" style={{ width: '100%' }} disabled={!editable.place} loading={units.loading}
          showSearch optionFilterProp="label" placeholder="Unit (HR › Units)" options={returnUnitOptions(units.list, value)}
          value={value.returnUnitId ?? (value.returnUnitName ? OWN_UNIT : undefined)} onChange={pickUnit} />
        {unitNote && <Text type="warning" style={{ fontSize: 12 }}>{unitNote}</Text>}
      </Col>
      <Col xs={24} md={8}><ReadOnlyField label="Delivery place" value={value.returnUnitAddress || '—'} /></Col>
      <Col xs={24} md={8}>
        <Label htmlFor={id(dateKey)}>Expected delivery date</Label>
        <IsoDatePicker id={id(dateKey)} aria-label="Expected delivery date" disabled={!editable.date} value={value[dateKey]}
          status={dateNote ? (dateNote.type === 'error' ? 'error' : 'warning') : undefined}
          disabledDate={minDate ? (d) => d.isBefore(minDate, 'day') : undefined} onChange={(v) => onChange({ [dateKey]: v })} />
        {dateNote && <Text type={dateNote.type === 'error' ? 'danger' : 'warning'} style={{ fontSize: 12 }}>{dateNote.text}</Text>}
      </Col>
      <Col xs={24} md={16}>
        <Label htmlFor={id('instructions')} required={false}>Processing instructions (printed)</Label>
        <Input.TextArea id={id('instructions')} aria-label="Processing instructions" rows={2} maxLength={2000} disabled={!editable.instructions}
          value={value.instructions ?? ''} onChange={(e) => onChange({ instructions: e.target.value })} />
      </Col>
    </Row>
  );
});

export default JobWorkDeliveryFields;
