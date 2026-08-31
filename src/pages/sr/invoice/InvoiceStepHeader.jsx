import { Row, Col, Input, DatePicker, Select, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

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
 * (PRD §10.4). Exporter block + IEC are read-only from the Company Master
 * (real organisation-info + profile extras); consignee prefills from the
 * buyer and stays editable per shipment.
 */
const InvoiceStepHeader = ({ inv, patch, profile, locked }) => (
  <Row gutter={24}>
    <Col xs={24} md={12}>
      <Field label="Exporter (Company Master — read-only)">
        <TextArea value={profile.exporterBlock} disabled autoSize style={{ backgroundColor: 'var(--bg-tertiary)' }} />
      </Field>
      <Field label="Consignee" required>
        <Input
          value={inv.consigneeName} disabled={locked}
          placeholder="Receiving party" style={{ marginBottom: 4 }}
          onChange={(e) => patch({ consigneeName: e.target.value })}
        />
        <TextArea
          value={inv.consigneeAddress} disabled={locked} rows={3}
          placeholder="Delivery address — prefilled from the buyer's shipping address, editable per shipment"
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
          <Field label="Exporter's Ref. (IEC No.)">
            <Input value={profile.extra?.iecNumber || ''} disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          </Field>
        </Col>
        <Col span={12}>
          <Field label="Invoice Series">
            <Select
              style={{ width: '100%' }} disabled={locked} value={inv.series || 'EXSG'}
              options={(profile.extra?.invoiceSeries || [{ code: 'EXSG', label: 'Full export' }]).map((s) => ({ value: s.code, label: `${s.code} — ${s.label}` }))}
              onChange={(v) => patch({ series: v })}
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

export default InvoiceStepHeader;
