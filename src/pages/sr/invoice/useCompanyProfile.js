import { useState, useEffect } from 'react';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { getCompanyProfileExtra } from '../../../services/sr/srService';

/**
 * Company profile for the commercial invoice: exporter block, GSTIN, address,
 * country and bank details come from the REAL organisation-info master;
 * the mock layer supplements only what it lacks — IEC, SWIFT, declaration
 * text, signatory, invoice series (editable without a code change per OQ3).
 */
const useCompanyProfile = () => {
  const [profile, setProfile] = useState({ loading: true, org: null, extra: null });

  useEffect(() => {
    (async () => {
      let org = getCachedOrganisation();
      if (!org) org = await fetchAndCacheOrganisation(); // never throws — returns null on failure
      const extra = await getCompanyProfileExtra().catch(() => null);
      setProfile({ loading: false, org, extra });
    })();
  }, []);

  const { org, extra } = profile;
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
      extra?.swiftCode ? `SWIFT CODE: ${extra.swiftCode}` : null,
    ].filter(Boolean).join('\n')
    : '';

  return {
    loading: profile.loading,
    org,
    extra,
    exporterBlock,
    bankBlock,
    exporterCountry: org?.country || extra?.exporterCountryFallback || 'India',
    companyName: org?.organisationName || '',
  };
};

export default useCompanyProfile;
