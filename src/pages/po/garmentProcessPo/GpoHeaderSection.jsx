import { memo } from 'react';
import { Card, Col, Input, Row, Typography } from 'antd';
import dayjs from 'dayjs';
import ReadOnlyField from '../jobWork/ReadOnlyField';
import JobWorkVendorSelect from '../jobWork/JobWorkVendorSelect';
import JobWorkVendorCard from '../jobWork/JobWorkVendorCard';
import PaymentTermsField from '../jobWork/PaymentTermsField';
import IsoDatePicker from '../../../components/form/IsoDatePicker';

const { Text } = Typography;
const Label = ({ children, required }) => <Text type="secondary" style={{ fontSize: 12 }}>{children}{required && <Text type="danger"> *</Text>}</Text>;

/**
 * ① PO Header (PRD §8.1, §19): PO number (auto), PO date, required date (defaults to the
 * earliest order delivery date — deviation D16), currency, payment terms, and the vendor with
 * its card. Job workers only: an inactive one cannot be picked; an unapproved or untagged one
 * warns, and the approver signs it off (§13). Delivery lives in ⑤.
 */
const GpoHeaderSection = memo(function GpoHeaderSection({ doc, editable, masters, eligibility, onPatch, onVendor }) {
  const vendorId = doc.vendor?.id ?? masters.jobWorkers.find((v) => v.gstin && v.gstin === doc.vendor?.gstin)?.id;
  const processLabel = doc.lines[0]?.processLabel ?? doc.process?.label;
  return (
    <Card id="gpo-header" size="small" title="① PO Header" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={12} md={4}><ReadOnlyField label="PO Number" value={doc.poNo || 'On save'} /></Col>
        <Col xs={12} md={4}>
          <Label required>PO Date</Label>
          <IsoDatePicker id="gpo-poDate" allowClear={false} disabled={!editable} value={doc.poDate}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(poDate) => onPatch({ poDate })} />
        </Col>
        <Col xs={12} md={4}>
          <Label required>Required Date</Label>
          <IsoDatePicker id="gpo-requiredDate" disabled={!editable} value={doc.requiredDate} onChange={(requiredDate) => onPatch({ requiredDate })} />
          {editable && <Text type="secondary" style={{ fontSize: 11 }}>Defaults to the earliest order delivery date</Text>}
        </Col>
        <Col xs={12} md={4}><ReadOnlyField label="Currency" value="INR – Indian Rupee" /></Col>
        <Col xs={12} md={4}>
          <Label required>Payment Terms</Label>
          <PaymentTermsField id="gpo-paymentTerms" terms={masters.paymentTerms} value={doc.paymentTerms} disabled={!editable} onChange={(paymentTerms) => onPatch({ paymentTerms })} />
        </Col>
        <Col xs={24} md={12}>
          <Label required>Vendor / Job Worker</Label>
          {editable ? (
            <JobWorkVendorSelect
              id="gpo-vendor-select" vendors={masters.jobWorkers} loading={masters.loading} value={vendorId} allowWarnings
              category="Garment"
              processId={doc.process?.id ?? null} processLabel={processLabel} onDate={doc.poDate} onChange={(v) => v && onVendor(v)}
            />
          ) : <Input id="gpo-vendor-name" aria-label="Vendor / Job Worker" value={doc.vendor?.name ?? ''} disabled placeholder="—" />}
        </Col>
      </Row>
      {doc.vendor && (
        <div style={{ marginTop: 12 }}>
          <JobWorkVendorCard vendor={{ ...doc.vendor, id: vendorId ?? null }} issue={eligibility?.issues?.[0]} frozen={!['DRAFT', 'SUBMITTED'].includes(doc.status)} />
        </div>
      )}
    </Card>
  );
});

export default GpoHeaderSection;
