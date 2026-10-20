import { memo } from 'react';
import { CarOutlined } from '@ant-design/icons';
import DetailCard from '../../../components/DetailCard';
import JobWorkDeliveryFields from '../jobWork/JobWorkDeliveryFields';
import { GPO_RETURN_TO } from '../../../utils/jobWorkConstants';
import { deliveryDateNote } from '../../../utils/jobWorkDelivery';

/**
 * Delivery Instructions (PRD §8.3): return to Factory / Production Unit / Finishing / Other,
 * the return unit and its address as the delivery place, the expected delivery date — not
 * before the PO date, a warning past the header's required date — and the processing
 * instructions (defaulted from the process master, printed for the vendor).
 */
const GpoDeliveryCard = memo(function GpoDeliveryCard({ doc, editable, units, onPatch }) {
  return (
    <DetailCard id="gpo-delivery" bare icon={<CarOutlined />} title="Delivery Instructions" style={{ height: '100%' }}>
      <JobWorkDeliveryFields
        value={doc} dateKey="expectedReturnDate" idPrefix="gpo" returnToOptions={GPO_RETURN_TO} units={units}
        editable={{ place: editable, date: editable, instructions: editable }} onChange={onPatch} minDate={doc.poDate}
        dateNote={deliveryDateNote(doc.expectedReturnDate, { notBefore: doc.poDate, warnAfter: doc.requiredDate })}
      />
    </DetailCard>
  );
});

export default GpoDeliveryCard;
