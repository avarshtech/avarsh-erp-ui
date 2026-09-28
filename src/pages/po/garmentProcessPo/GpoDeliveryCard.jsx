import { memo } from 'react';
import { Alert, Card, Input, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import ReadOnlyField from '../jobWork/ReadOnlyField';
import { GPO_RETURN_TO } from '../../../utils/jobWorkConstants';

const { Text } = Typography;
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12 }}>{children}<Text type="danger"> *</Text></Text>;

/**
 * ⑤ Delivery & Movement (PRD §8.3): send to the vendor, return to Factory / Production
 * Unit / Finishing / Other, planned send (≥ PO date) and expected return (≥ planned send;
 * a warning past the required date). Planned dates only — dispatch and receipt belong to
 * the movement module.
 */
const GpoDeliveryCard = memo(function GpoDeliveryCard({ doc, editable, onPatch }) {
  const late = doc.expectedReturnDate && doc.requiredDate && dayjs(doc.expectedReturnDate).isAfter(doc.requiredDate, 'day');
  const backwards = doc.expectedReturnDate && doc.plannedSendDate && dayjs(doc.expectedReturnDate).isBefore(doc.plannedSendDate, 'day');
  return (
    <Card id="gpo-delivery" size="small" title="⑤ Delivery & Movement" style={{ height: '100%' }}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <ReadOnlyField label="Send To" value={doc.vendor ? `${doc.vendor.name} (vendor)` : '—'} />
        <div>
          <Label>Return To</Label>
          <Select id="gpo-returnTo" style={{ width: '100%' }} disabled={!editable} options={GPO_RETURN_TO} value={doc.returnTo ?? undefined}
            onChange={(returnTo) => onPatch({ returnTo })} />
          {doc.returnTo === 'OTHER' && (
            <Input id="gpo-returnToOther" style={{ marginTop: 6 }} disabled={!editable} placeholder="Where do the garments return to?"
              value={doc.returnToOther} onChange={(e) => onPatch({ returnToOther: e.target.value })} />
          )}
        </div>
        <div>
          <Label>Planned Send Date</Label>
          <IsoDatePicker id="gpo-plannedSendDate" disabled={!editable} value={doc.plannedSendDate}
            disabledDate={(d) => Boolean(doc.poDate) && d.isBefore(doc.poDate, 'day')} onChange={(plannedSendDate) => onPatch({ plannedSendDate })} />
        </div>
        <div>
          <Label>Expected Return</Label>
          <IsoDatePicker id="gpo-expectedReturnDate" disabled={!editable} value={doc.expectedReturnDate} status={backwards ? 'error' : late ? 'warning' : undefined}
            onChange={(expectedReturnDate) => onPatch({ expectedReturnDate })} />
          {backwards && <Text type="danger" style={{ fontSize: 12 }}>Must be on or after the planned send date.</Text>}
          {late && !backwards && <Text type="warning" style={{ fontSize: 12 }}>After the required date.</Text>}
        </div>
        <Alert type="info" showIcon title="Planned dates only. Actual dispatch and receipt are handled in the movement module." />
      </Space>
    </Card>
  );
});

export default GpoDeliveryCard;
