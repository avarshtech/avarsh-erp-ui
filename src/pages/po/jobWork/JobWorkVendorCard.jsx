import { memo } from 'react';
import { Alert, Descriptions, Tag } from 'antd';
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
      <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} items={[
        { key: 'code', label: 'Code', children: vendor.id ?? '—' },
        { key: 'gstin', label: 'GSTIN', children: vendor.gstin || '—' },
        { key: 'addr', label: 'Address', span: 2, children: [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ') || '—' },
        { key: 'contact', label: 'Contact', children: [vendor.contactPerson, vendor.phone].filter(Boolean).join(' · ') || '—' },
        { key: 'email', label: 'Email', children: vendor.email || '—' },
        { key: 'tax', label: 'GST', children: vendor.igstApplicable ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)' },
        {
          key: 'approval', label: 'Job-work approval',
          children: <><Tag color={approval.color}>{approval.label}</Tag>{frozen && <Tag>Snapshot frozen on approval</Tag>}</>,
        },
      ]} />
    </>
  );
});

export default JobWorkVendorCard;
