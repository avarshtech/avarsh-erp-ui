import { memo } from 'react';
import { Alert, Space, Tag } from 'antd';
import FactSheet from '../../../components/FactSheet';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

/**
 * The job worker as the PO holds it — the snapshot taken on every save and frozen on
 * approval (CPP FR-20), so a later master change never rewrites an issued PO.
 * `issue` is the live eligibility problem, if any.
 */
const JobWorkVendorCard = memo(function JobWorkVendorCard({ vendor, issue, frozen }) {
  if (!vendor) return null;
  const approval = jobWorkApproval(vendor.jobWorkApprovedUntil);
  return (
    <>
      {issue && <Alert type={issue.warnOnly ? 'warning' : 'error'} showIcon title={issue.text} style={{ marginBottom: 8 }} />}
      <FactSheet fields={[
        { label: 'Code', value: vendor.id },
        { label: 'GSTIN', value: vendor.gstin },
        { label: 'GST', value: vendor.igstApplicable ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)' },
        { label: 'Contact', value: [vendor.contactPerson, vendor.phone].filter(Boolean).join(' · ') },
        { label: 'Email', value: vendor.email },
        { label: 'Address', wide: true, value: [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ') },
        {
          label: 'Job-work approval',
          value: <Space size={4} wrap><Tag color={approval.color}>{approval.label}</Tag>{frozen && <Tag>Snapshot frozen on approval</Tag>}</Space>,
        },
      ]} />
    </>
  );
});

export default JobWorkVendorCard;
