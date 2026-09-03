import { useState, useEffect } from 'react';
import { getExporterProfileExtra } from '../../../services/expdoc/expDocService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';

/**
 * The exporter block that every printed document in this module carries.
 *
 * It is a printable address, not just a name: the organisation master supplies the
 * address, and the mock profile supplies the statutory references the master has no
 * columns for (IEC, AD code, LUT) — the `exporterProfileExtra` gap in the ledger.
 *
 * Shared by the packing list and the stickers so the same header cannot drift
 * between two documents describing the same shipment.
 */
const compose = (org, extra) => {
  // With no organisation record there is no address to print, and a lone
  // "IEC: ..." line would read as one. Leave the block empty and let the caller's
  // banner say why, rather than printing a fragment that looks like an address.
  if (!org?.organisationName) return { ...extra, name: null, country: 'INDIA', block: '', bankBlock: '' };

  /*
   * The bank block, composed the same way the sampling module composes it. The
   * invoice renderer prints "Our Bankers" followed by `exporter.bankBlock`; without
   * this it printed the heading over nothing on every document.
   */
  const bankBlock = [
    org.bankName ? `${org.bankName}${org.bankBranch ? `, ${org.bankBranch}` : ''}` : null,
    org.bankAccountNumber ? `A/C NO: ${org.bankAccountNumber}` : null,
    org.bankIfscCode ? `IFSC: ${org.bankIfscCode}` : null,
    extra?.swiftCode ? `SWIFT CODE: ${extra.swiftCode}` : null,
  ].filter(Boolean).join('\n');

  const block = [
    org.organisationName,
    [org.addressLine1, org.addressLine2].filter(Boolean).join(', '),
    [org.city, org.state, org.pincode].filter(Boolean).join(', '),
    org.gstin ? `GSTIN: ${org.gstin}` : null,
    extra?.iecNumber ? `IEC: ${extra.iecNumber}` : null,
  ].filter(Boolean).join('\n');
  return { ...org, ...extra, name: org.organisationName, country: org.country || 'INDIA', block, bankBlock };
};

/** Returns null until resolved; then always an object, with `block: ''` on failure. */
const useExporterBlock = () => {
  const [exporter, setExporter] = useState(null);

  useEffect(() => {
    let alive = true;
    const extra = getExporterProfileExtra();
    // The cached organisation resolves without a request; wrapping it in a promise
    // anyway keeps one code path and one place where state is set.
    const cached = getCachedOrganisation();
    Promise.resolve(cached || fetchAndCacheOrganisation())
      .then((o) => { if (alive) setExporter(compose(o, extra)); })
      .catch(() => { if (alive) setExporter(compose(null, extra)); });
    return () => { alive = false; };
  }, []);

  return exporter;
};

export default useExporterBlock;
