import { useState, useEffect, useMemo } from 'react';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';

/**
 * Company profile for a sample invoice — exporter block, GSTIN, address,
 * country, bank details and the export-document fields (IEC, SWIFT, signatory,
 * declarations, number series) all come from the organisation record, editable
 * on Admin → Company Profile.
 *
 * `extra` is kept as a shape rather than read field-by-field because the
 * invoice steps and the PDF generator address it that way; with no organisation
 * row configured it is simply empty and those fields print blank.
 */
const useCompanyProfile = () => {
  const [profile, setProfile] = useState({ loading: true, org: null });

  useEffect(() => {
    (async () => {
      let org = getCachedOrganisation();
      if (!org) org = await fetchAndCacheOrganisation(); // never throws — returns null on failure
      setProfile({ loading: false, org });
    })();
  }, []);

  const { org } = profile;

  const extra = useMemo(() => (org ? {
    iecNumber: org.iecNumber,
    swiftCode: org.swiftCode,
    signatory: org.authorisedSignatory,
    // The commercial (export/customs) invoice carries the free-of-charge
    // declaration; the SA-series sample invoice carries the actual-price one
    declarationText: org.declarationTextCommercial,
    declarationTextSample: org.declarationTextSample,
    invoiceSeries: [
      { code: org.commercialInvoiceSeries || 'EXSG', label: 'Commercial (export/customs)' },
      { code: org.sampleInvoiceSeries || 'SA', label: 'Sample (chargeable)' },
    ],
    defaultSeries: org.commercialInvoiceSeries || 'EXSG',
  } : null), [org]);

  const exporterBlock = org
    ? [org.organisationName,
      [org.addressLine1, org.addressLine2].filter(Boolean).join(', '),
      [org.city, org.state, org.pincode].filter(Boolean).join(', '),
      org.gstin ? `GST NO: ${org.gstin}` : null,
    ].filter(Boolean).join('\n')
    : '';
  const bankBlock = org
    ? [org.bankName ? `${org.bankName}${org.bankBranch ? `, ${org.bankBranch}` : ''}` : null,
      org.bankAccountNumber ? `A/C NO: ${org.bankAccountNumber}` : null,
      org.bankIfscCode ? `IFSC: ${org.bankIfscCode}` : null,
      org.swiftCode ? `SWIFT CODE: ${org.swiftCode}` : null,
    ].filter(Boolean).join('\n')
    : '';

  return {
    loading: profile.loading,
    org,
    extra,
    exporterBlock,
    bankBlock,
    // No organisation row configured: overseas detection and the customs gate
    // treat the company as domestic, and Company Profile shows the warning.
    exporterCountry: org?.country || '',
    companyName: org?.organisationName || '',
  };
};

export default useCompanyProfile;
