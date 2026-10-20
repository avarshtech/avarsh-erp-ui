import { memo } from 'react';
import { Col, Input, Row, Select, Typography } from 'antd';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import ReadOnlyField from './ReadOnlyField';
import PoField from './PoField';
import { OWN_UNIT, returnUnitOptions, unitSnapshot } from '../../../utils/jobWorkDelivery';
import { optionLabel } from '../../../utils/jobWorkConstants';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

const unitNoteOf = (units) => {
  if (units.failed) return 'Units could not be loaded — picking one needs HR Masters (view) access.';
  return !units.loading && !units.list.length ? 'No active unit in this branch — add one in HR › Masters › Units.' : null;
};

/**
 * Delivery Instructions of a job-work PO: Return To (named when "Other"), the return unit
 * from the Unit master with its address as the delivery place, the expected delivery date
 * and the processing instructions. Ids are `${idPrefix}-…`, so a dialog can reuse the fields
 * beside the page's. `editable` = { place, date, instructions } — an editable field holds its input, any other shows
 * its value as text; `onChange(patch)` gets one group per call — place, date or instructions — so an open amendment
 * can take the date alone. `units` comes from useJobWorkUnits; `dateNote` = { type: 'error' | 'warning', text }.
 */
const JobWorkDeliveryFields = memo(function JobWorkDeliveryFields({
  value, dateKey, idPrefix, returnToOptions, units, editable, onChange, dateNote = null, minDate = null,
}) {
  const id = (field) => `${idPrefix}-${field}`;
  const pickUnit = (unitId) => { if (unitId !== OWN_UNIT) onChange(unitSnapshot(units.list.find((u) => u.id === unitId))); };
  const unitNote = editable.place ? unitNoteOf(units) : null;
  const returnTo = value.returnTo === 'OTHER' ? value.returnToOther : optionLabel(returnToOptions, value.returnTo);
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <PoField label="Return to" required editing={editable.place} htmlFor={id('returnTo')} text={returnTo}>
          <Select id={id('returnTo')} aria-label="Return to" style={{ width: '100%' }} options={returnToOptions}
            value={value.returnTo ?? undefined} onChange={(returnTo) => onChange({ returnTo })} />
          {value.returnTo === 'OTHER' && (
            <Input id={id('returnToOther')} aria-label="Return to (other)" style={{ marginTop: 6 }} maxLength={200}
              placeholder="Where do the goods return to?" value={value.returnToOther ?? ''} onChange={(e) => onChange({ returnToOther: e.target.value })} />
          )}
        </PoField>
      </Col>
      <Col xs={24} md={8}>
        <PoField label="Return unit" required editing={editable.place} htmlFor={id('returnUnit')} text={value.returnUnitName}>
          <Select id={id('returnUnit')} aria-label="Return unit" style={{ width: '100%' }} loading={units.loading}
            showSearch optionFilterProp="label" placeholder="Unit (HR › Units)" options={returnUnitOptions(units.list, value)}
            value={value.returnUnitId ?? (value.returnUnitName ? OWN_UNIT : undefined)} onChange={pickUnit} />
          {unitNote && <Text type="warning" style={{ fontSize: 12 }}>{unitNote}</Text>}
        </PoField>
      </Col>
      <Col xs={24} md={8}><ReadOnlyField label="Delivery place" value={value.returnUnitAddress || '—'} locked={editable.place} /></Col>
      <Col xs={24} md={8}>
        <PoField label="Expected delivery date" required editing={editable.date} htmlFor={id(dateKey)} text={formatDate(value[dateKey])}>
          <IsoDatePicker id={id(dateKey)} aria-label="Expected delivery date" value={value[dateKey]}
            status={dateNote ? (dateNote.type === 'error' ? 'error' : 'warning') : undefined}
            disabledDate={minDate ? (d) => d.isBefore(minDate, 'day') : undefined} onChange={(v) => onChange({ [dateKey]: v })} />
        </PoField>
        {dateNote && <Text type={dateNote.type === 'error' ? 'danger' : 'warning'} style={{ fontSize: 12 }}>{dateNote.text}</Text>}
      </Col>
      <Col xs={24} md={16}>
        <PoField label="Processing instructions (printed)" editing={editable.instructions} htmlFor={id('instructions')} text={value.instructions}>
          <Input.TextArea id={id('instructions')} aria-label="Processing instructions" rows={2} maxLength={2000}
            value={value.instructions ?? ''} onChange={(e) => onChange({ instructions: e.target.value })} />
        </PoField>
      </Col>
    </Row>
  );
});

export default JobWorkDeliveryFields;
