import { memo } from 'react';
import { Col, Row, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailCard from '../../../components/DetailCard';
import ReadOnlyField from '../jobWork/ReadOnlyField';
import PoField from '../jobWork/PoField';
import JobWorkVendorSelect from '../jobWork/JobWorkVendorSelect';
import JobWorkVendorCard from '../jobWork/JobWorkVendorCard';
import PaymentTermsField from '../jobWork/PaymentTermsField';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

/**
 * PO Header (PRD §8.1, §19): PO number (shown once the first save gives it one), PO date, required date (defaults to the
 * earliest order delivery date — deviation D16), currency, payment terms, and the vendor with
 * its card. Job workers only: an inactive one cannot be picked; an unapproved or untagged one
 * warns, and the approver signs it off (§13). Delivery lives in Delivery Instructions. In the Supplier PO view's look:
 * label over value, inputs only while the draft is being edited.
 */
const GpoHeaderSection = memo(function GpoHeaderSection({ doc, editable, masters, eligibility, onPatch, onVendor }) {
  const vendorId = doc.vendor?.id ?? masters.jobWorkers.find((v) => v.gstin && v.gstin === doc.vendor?.gstin)?.id;
  const processLabel = doc.lines[0]?.processLabel ?? doc.process?.label;
  // An unsaved PO has no number: its column goes and the other four share the row (5 + 4 + 5 + 5 + 5 with it)
  const numbered = Boolean(doc.poNo);
  const span = (withNumber) => (numbered ? withNumber : 6);
  return (
    <DetailCard id="gpo-header" bare icon={<FileTextOutlined />} title="PO Header" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {numbered && <Col xs={12} md={5}><ReadOnlyField label="PO Number" value={doc.poNo} locked={editable} /></Col>}
        <Col xs={12} md={span(4)}>
          <PoField label="PO Date" required editing={editable} htmlFor="gpo-poDate" text={formatDate(doc.poDate)}>
            <IsoDatePicker id="gpo-poDate" allowClear={false} value={doc.poDate}
              disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(poDate) => onPatch({ poDate })} />
          </PoField>
        </Col>
        <Col xs={12} md={span(5)}>
          <PoField label="Required Date" required editing={editable} htmlFor="gpo-requiredDate" text={formatDate(doc.requiredDate)}>
            <IsoDatePicker id="gpo-requiredDate" value={doc.requiredDate} onChange={(requiredDate) => onPatch({ requiredDate })} />
            <Text type="secondary" style={{ fontSize: 11 }}>Defaults to the earliest order delivery date</Text>
          </PoField>
        </Col>
        <Col xs={12} md={span(5)}><ReadOnlyField label="Currency" value="INR – Indian Rupee" locked={editable} /></Col>
        <Col xs={12} md={span(5)}>
          <PoField label="Payment Terms" required editing={editable} htmlFor="gpo-paymentTerms" text={doc.paymentTerms}>
            <PaymentTermsField id="gpo-paymentTerms" terms={masters.paymentTerms} value={doc.paymentTerms} onChange={(paymentTerms) => onPatch({ paymentTerms })} />
          </PoField>
        </Col>
        <Col xs={24} md={12}>
          <PoField label="Vendor / Job Worker" required editing={editable} htmlFor="gpo-vendor-select" text={doc.vendor?.name}>
            <JobWorkVendorSelect
              id="gpo-vendor-select" vendors={masters.jobWorkers} loading={masters.loading} value={vendorId} allowWarnings
              category="Garment"
              processId={doc.process?.id ?? null} processLabel={processLabel} onDate={doc.poDate} onChange={(v) => v && onVendor(v)}
            />
          </PoField>
        </Col>
      </Row>
      {doc.vendor && (
        <div style={{ marginTop: 16 }}>
          <JobWorkVendorCard vendor={{ ...doc.vendor, id: vendorId ?? null }} issue={eligibility?.issues?.[0]} frozen={!['DRAFT', 'SUBMITTED'].includes(doc.status)} />
        </div>
      )}
    </DetailCard>
  );
});

export default GpoHeaderSection;
