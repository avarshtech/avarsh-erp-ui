import { useCallback, useMemo } from 'react';
import { Row, Col, Input, DatePicker, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  activeLocations, formatLocationAddress, findBuyerByName, consigneeFromLocation, consigneeFromBuyer,
} from './consigneeAddress';
import { useBranch } from '../../../context/BranchContext';
import { withExportingBranch } from './useCompanyProfile';

const { Text } = Typography;
const { TextArea } = Input;

/** A shipping location as the picker lists it — the label, placed by its city. */
const locationOption = (l) => ({
  value: l.id,
  label: l.city ? `${l.label} — ${l.city}` : l.label,
});

const Field = ({ label, required, children, hint }) => (
  <div style={{ marginBottom: 12 }}>
    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
      {label}{required && <Text type="danger"> *</Text>}
    </Text>
    {children}
    {hint && <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{hint}</Text>}
  </div>
);

/**
 * Step 2 — header fields following the existing Avarsh export invoice layout
 * (PRD §10.4). The exporter block is read-only from the Company Master (real
 * organisation-info + profile extras); Exporter's Ref starts as its IEC number
 * and is the invoice's own, editable.
 *
 * The consignee is chosen from the Buyer master and its delivery address is
 * rendered from that buyer's shipping locations, but both are still written to
 * the invoice as plain text — a snapshot, so a buyer re-addressed next season
 * does not rewrite an invoice already raised. Which location is in force is
 * therefore DERIVED by comparing the address text rather than stored: edit the
 * address by hand and the picker simply shows nothing selected, which is the
 * honest answer. Both invoice types render this same step.
 */
const InvoiceStepHeader = ({ inv, patch, profile, locked, buyers }) => {
  // Multi-branch only: which branch exports (its address + GSTIN print as the exporter)
  const { isMultiBranch, allowedBranches } = useBranch();
  const exporterBlock = withExportingBranch(profile, inv).exporterBlock;

  const consigneeBuyer = useMemo(
    () => findBuyerByName(buyers, inv.consigneeName),
    [buyers, inv.consigneeName],
  );

  const locations = useMemo(() => activeLocations(consigneeBuyer), [consigneeBuyer]);

  /**
   * A consignee saved before this picker existed — or one whose buyer has since
   * been renamed or retired — still has to be shown, so it joins the list as
   * its own option instead of silently reading as "nothing selected".
   *
   * Options are keyed by name because the name is what the invoice stores, and
   * mst_buyers.name carries no unique constraint — so they are de-duplicated
   * here rather than handing antd two options with the same key.
   */
  const buyerOptions = useMemo(() => {
    const names = new Set((buyers || []).map((b) => b.name).filter(Boolean));
    if (inv.consigneeName && !names.has(inv.consigneeName)) {
      return [
        { value: inv.consigneeName, label: `${inv.consigneeName} — not in Buyer master` },
        ...[...names].map((n) => ({ value: n, label: n })),
      ];
    }
    return [...names].map((n) => ({ value: n, label: n }));
  }, [buyers, inv.consigneeName]);

  // Which location the current address text came from, or none once it has been
  // edited by hand. Nothing to store: the address itself is the record.
  const selectedLocationId = useMemo(() => {
    const match = locations.find((l) => formatLocationAddress(l) === (inv.consigneeAddress || ''));
    return match ? match.id : undefined;
  }, [locations, inv.consigneeAddress]);

  const handleConsigneeChange = useCallback((name) => {
    // A different consignee means different buyer details — carrying the previous
    // buyer's over would be worse than blanking them. One location is unambiguous
    // and fills the address, contact and destination; several wait to be picked.
    patch({ consigneeName: name, ...consigneeFromBuyer(findBuyerByName(buyers, name)) });
  }, [buyers, patch]);

  // Picking a location loads the buyer's details from it: address, contact, destination.
  const handleLocationChange = useCallback((locationId) => {
    const loc = locations.find((l) => l.id === locationId);
    if (loc) patch(consigneeFromLocation(consigneeBuyer, loc));
  }, [locations, consigneeBuyer, patch]);

  return (
    <Row gutter={24}>
      <Col xs={24} md={12}>
        {/* Multi-branch only: which branch exports — its address and GSTIN
            print as the exporter in place of the company profile's. */}
        {isMultiBranch && (
          <Field label="Exporting Branch" hint="Its address and GSTIN print as the exporter; blank = company profile">
            <Select
              aria-label="Exporting Branch"
              value={inv.branchId ?? undefined}
              disabled={locked}
              allowClear
              placeholder="Company profile"
              style={{ width: '100%' }}
              options={allowedBranches.map((b) => ({ value: b.id, label: b.branchName }))}
              onChange={(v) => patch({ branchId: v ?? null })}
            />
          </Field>
        )}
        <Field label="Exporter (Company Master — read-only)">
          <TextArea value={exporterBlock} disabled autoSize style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        </Field>
        <Field
          label="Consignee"
          required
          hint={consigneeBuyer && locations.length === 0
            ? 'This buyer has no active shipping location — add one in Master Data → Buyers, or type the address below'
            : undefined}
        >
          {/* With no buyer master to pick from — the load failed, or none is
              set up — a closed Select would leave no way to name a consignee,
              and an invoice cannot be issued without one. Fall back to the free
              text this field used to be rather than blocking the screen. */}
          {buyerOptions.length === 0 ? (
            <Input
              value={inv.consigneeName} disabled={locked}
              placeholder="Receiving party — Buyer master unavailable, type the name"
              style={{ marginBottom: 4 }}
              onChange={(e) => patch({ consigneeName: e.target.value })}
            />
          ) : (
            <Select
              value={inv.consigneeName || undefined} disabled={locked}
              placeholder="Receiving party — from Buyer master"
              style={{ width: '100%', marginBottom: 4 }}
              showSearch optionFilterProp="label"
              options={buyerOptions}
              onChange={handleConsigneeChange}
            />
          )}
          {/* Shown even for a lone location: once the address below has been
              edited by hand this is the only way back to the one on file. */}
          {locations.length > 0 && (
            <Select
              value={selectedLocationId} disabled={locked}
              placeholder="Delivery address — pick a shipping location"
              style={{ width: '100%', marginBottom: 4 }}
              options={locations.map(locationOption)}
              onChange={handleLocationChange}
            />
          )}
          <TextArea
            value={inv.consigneeAddress} disabled={locked} rows={3}
            placeholder="Delivery address — rendered from the buyer's shipping location, editable per shipment"
            style={{ marginBottom: 4 }}
            onChange={(e) => patch({ consigneeAddress: e.target.value })}
          />
          <Input
            value={inv.consigneeContact} disabled={locked}
            placeholder="Attn: contact person · phone (prints under the consignee address)"
            onChange={(e) => patch({ consigneeContact: e.target.value })}
          />
        </Field>
        <Row gutter={12}>
          <Col span={12}>
            <Field label="Buyer (other than Consignee)">
              <Input value={inv.buyerOtherThanConsignee} disabled={locked} placeholder="Leave blank if same as consignee" onChange={(e) => patch({ buyerOtherThanConsignee: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Notify Party">
              <Input value={inv.notifyParty} disabled={locked} placeholder="Forwarder / agent to notify" onChange={(e) => patch({ notifyParty: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Col>
      <Col xs={24} md={12}>
        <Row gutter={12}>
          <Col span={12}>
            <Field label="Invoice No." hint={`Assigned on Issue · series ${inv.series || 'EXSG'}`}>
              <Input value={inv.invoiceNo || 'Assigned on Issue'} disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Invoice Date" required>
              <DatePicker
                style={{ width: '100%' }} disabled={locked}
                value={inv.invoiceDate ? dayjs(inv.invoiceDate) : null}
                onChange={(d) => patch({ invoiceDate: d ? d.format('YYYY-MM-DD') : null })}
              />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Exporter's Ref." hint="Defaults to the IEC No. in Company Profile">
              <Input
                aria-label="Exporter's Ref."
                value={inv.exporterRef ?? profile.extra?.iecNumber ?? ''} disabled={locked} maxLength={100}
                onChange={(e) => patch({ exporterRef: e.target.value })}
              />
            </Field>
          </Col>
          <Col span={12}>
            {/* Read-only: the series is the organisation's book for this invoice
                type, set in the Company Profile and applied server-side. A picker
                here would have been a control that changed nothing. */}
            <Field label="Invoice Series" hint="Set per invoice type in Company Profile">
              <Select
                style={{ width: '100%' }} disabled value={inv.series || 'EXSG'}
                options={(profile.extra?.invoiceSeries || [{ code: 'EXSG', label: 'Full export' }]).map((s) => ({ value: s.code, label: `${s.code} — ${s.label}` }))}
              />
            </Field>
          </Col>
          <Col span={24}>
            <Field label="Buyer's Order No. & Date">
              <Input value={inv.buyerOrderNoDate} disabled={locked} onChange={(e) => patch({ buyerOrderNoDate: e.target.value })} />
            </Field>
          </Col>
          <Col span={24}>
            <Field label="Other References">
              <Input value={inv.otherReferences} disabled={locked} placeholder="e.g. Sample submission — SS27 development" onChange={(e) => patch({ otherReferences: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Country of Origin" required>
              <Input value={inv.countryOfOrigin} disabled={locked} onChange={(e) => patch({ countryOfOrigin: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Country of Final Destination" required>
              <Input value={inv.destinationCountry} disabled={locked} onChange={(e) => patch({ destinationCountry: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Pre-Carriage by">
              <Input value={inv.preCarriage} disabled={locked} onChange={(e) => patch({ preCarriage: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Place of Receipt by Pre-Carrier">
              <Input value={inv.placeOfReceipt} disabled={locked} onChange={(e) => patch({ placeOfReceipt: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Vessel / Flight No.">
              <Input value={inv.vesselFlightNo} disabled={locked} onChange={(e) => patch({ vesselFlightNo: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Port of Loading">
              <Input value={inv.portOfLoading} disabled={locked} onChange={(e) => patch({ portOfLoading: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Port of Discharge">
              <Input value={inv.portOfDischarge} disabled={locked} onChange={(e) => patch({ portOfDischarge: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Final Destination">
              <Input value={inv.finalDestination} disabled={locked} onChange={(e) => patch({ finalDestination: e.target.value })} />
            </Field>
          </Col>
          <Col span={24}>
            <Field label="Terms of Delivery & Payment" required hint="Pre-filled from the SR's dispatch mode where one is recorded">
              <Input value={inv.termsOfDelivery} disabled={locked} onChange={(e) => patch({ termsOfDelivery: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Payment Terms" hint="e.g. SAMPLES ONLY (commercial) · TT 30 DAYS (chargeable)">
              <Input value={inv.paymentTerms} disabled={locked} onChange={(e) => patch({ paymentTerms: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Container No.">
              <Input value={inv.containerNo} disabled={locked} placeholder="Blank for courier parcels" onChange={(e) => patch({ containerNo: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="Marks & Nos." hint="Prints in the line-item block">
              <Input value={inv.marksAndNos} disabled={locked} onChange={(e) => patch({ marksAndNos: e.target.value })} />
            </Field>
          </Col>
          <Col span={12}>
            <Field label="No. & Kind of Packages" hint="Prints in the line-item block">
              <Input value={inv.packages} disabled={locked} onChange={(e) => patch({ packages: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default InvoiceStepHeader;
