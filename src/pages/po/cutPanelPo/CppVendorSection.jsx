import { memo } from 'react';
import { Alert, Col, Row } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import DetailCard from '../../../components/DetailCard';
import PoField from '../jobWork/PoField';
import JobWorkVendorSelect from '../jobWork/JobWorkVendorSelect';
import JobWorkVendorCard from '../jobWork/JobWorkVendorCard';
import PaymentTermsField from '../jobWork/PaymentTermsField';
import { vendorSnapshot } from '../../../utils/jobWorkPoLines';

/**
 * Job Worker (PRD §8.4): approved job workers for the PO's process, the ineligible ones
 * greyed with the reason (FR-19, BR-14); the vendor card; payment terms from the Payment
 * Terms master (D5). The vendor is editable in Draft and while Approved until sent (BR-16);
 * payment terms also in an open amendment. `editable` = { vendor, terms }. Delivery lives in Delivery Instructions & Value.
 */
const CppVendorSection = memo(function CppVendorSection({ doc, editable, masters, eligibility, onPatch }) {
  // The vendor's payment terms become the PO's only when they name a Payment Terms master
  // entry (D5); free text is kept when the master is unreadable or empty.
  const pickVendor = (v) => {
    const fromVendor = !masters.paymentTerms.length || masters.paymentTerms.some((t) => t.name === v.paymentTerms);
    onPatch({ vendor: vendorSnapshot(v), paymentTerms: (fromVendor && v.paymentTerms) || doc.paymentTerms || null });
  };
  // A seeded PO's snapshot has no vendor id: the live vendor with its GSTIN stands in.
  const vendorId = doc.vendor?.id ?? masters.jobWorkers.find((v) => v.gstin && v.gstin === doc.vendor?.gstin)?.id;
  const issue = eligibility?.issues?.[0];
  return (
    <DetailCard id="cpp-vendor" bare icon={<ShopOutlined />} title="Job Worker" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <PoField label="Job worker" required editing={editable.vendor} htmlFor="cpp-vendor-select" text={doc.vendor?.name}>
            <JobWorkVendorSelect
              id="cpp-vendor-select" vendors={masters.jobWorkers} loading={masters.loading} value={vendorId} category="Cut Panel"
              processId={doc.process?.id ?? null} processLabel={doc.process?.label ?? doc.process?.name} onDate={doc.poDate}
              onChange={(v) => v && pickVendor(v)} disabled={!doc.process}
            />
          </PoField>
        </Col>
        <Col xs={24} md={6}>
          <PoField label="Payment terms" required editing={editable.terms} htmlFor="cpp-paymentTerms" text={doc.paymentTerms}>
            <PaymentTermsField id="cpp-paymentTerms" terms={masters.paymentTerms} value={doc.paymentTerms} onChange={(paymentTerms) => onPatch({ paymentTerms })} />
          </PoField>
        </Col>
      </Row>
      {doc.vendor && (
        <div style={{ marginTop: 12 }}>
          <JobWorkVendorCard vendor={{ ...doc.vendor, id: vendorId ?? null }} issue={issue} frozen={!['DRAFT', 'SUBMITTED'].includes(doc.status)} />
        </div>
      )}
      {!doc.process && editable.vendor && <Alert type="info" showIcon title="Choose the panel process first — job workers are listed for it." style={{ marginTop: 12 }} />}
    </DetailCard>
  );
});

export default CppVendorSection;
