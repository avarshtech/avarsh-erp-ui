import { memo } from 'react';
import { Alert, Card, Col, Input, Row, Typography } from 'antd';
import JobWorkVendorSelect from '../jobWork/JobWorkVendorSelect';
import JobWorkVendorCard from '../jobWork/JobWorkVendorCard';
import PaymentTermsField from '../jobWork/PaymentTermsField';
import { vendorSnapshot } from '../../../utils/jobWorkPoLines';

const { Text } = Typography;
const Label = ({ children, required }) => <Text type="secondary" style={{ fontSize: 12 }}>{children}{required && <Text type="danger"> *</Text>}</Text>;

/**
 * ③ Job Worker (PRD §8.4): approved job workers for the PO's process, the ineligible ones
 * greyed with the reason (FR-19, BR-14); the vendor card; payment terms from the Payment
 * Terms master (D5). The vendor is editable in Draft and while Approved until sent (BR-16);
 * payment terms also in an open amendment. `editable` = { vendor, terms }. Delivery lives in ⑤.
 */
const CppVendorSection = memo(function CppVendorSection({ doc, editable, masters, eligibility, onPatch }) {
  // The vendor's payment terms become the PO's only when they name a Payment Terms master
  // entry (D5); free text is kept when the master is unreadable or empty.
  const pickVendor = (v) => {
    const fromVendor = !masters.paymentTerms.length || masters.paymentTerms.some((t) => t.name === v.paymentTerms);
    onPatch({ vendor: vendorSnapshot(v), paymentTerms: (fromVendor && v.paymentTerms) || doc.paymentTerms || null });
  };
  // A seeded PO's snapshot has no supplier id: the live supplier with its GSTIN stands in.
  const vendorId = doc.vendor?.id ?? masters.jobWorkers.find((v) => v.gstin && v.gstin === doc.vendor?.gstin)?.id;
  const issue = eligibility?.issues?.[0];
  const deniedSuppliers = masters.denied.includes('Suppliers');
  return (
    <Card id="cpp-vendor" size="small" title="③ Job Worker" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={24} md={12}>
          <Label required>Job worker</Label>
          {editable.vendor && !deniedSuppliers ? (
            <JobWorkVendorSelect
              id="cpp-vendor-select" vendors={masters.jobWorkers} loading={masters.loading} value={vendorId}
              processId={doc.process?.id ?? null} processLabel={doc.process?.label ?? doc.process?.name} onDate={doc.poDate}
              onChange={(v) => v && pickVendor(v)} disabled={!doc.process}
            />
          ) : <Input id="cpp-vendor-name" aria-label="Job worker" value={doc.vendor?.name ?? ''} disabled placeholder="—" />}
          {editable.vendor && deniedSuppliers && <Text type="warning" style={{ fontSize: 12 }}>Picking a job worker needs Suppliers (view) permission.</Text>}
        </Col>
        <Col xs={24} md={6}>
          <Label required>Payment terms</Label>
          <PaymentTermsField id="cpp-paymentTerms" terms={masters.paymentTerms} value={doc.paymentTerms} disabled={!editable.terms} onChange={(paymentTerms) => onPatch({ paymentTerms })} />
        </Col>
      </Row>
      {doc.vendor && (
        <div style={{ marginTop: 12 }}>
          <JobWorkVendorCard vendor={{ ...doc.vendor, id: vendorId ?? null }} issue={issue} frozen={!['DRAFT', 'SUBMITTED'].includes(doc.status)} />
        </div>
      )}
      {!doc.process && editable.vendor && <Alert type="info" showIcon title="Choose the panel process first — job workers are listed for it." style={{ marginTop: 12 }} />}
    </Card>
  );
});

export default CppVendorSection;
