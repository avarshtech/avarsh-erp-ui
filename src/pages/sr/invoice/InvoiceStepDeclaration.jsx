import { Row, Col, Input, Select, Alert, Typography, Statistic } from 'antd';
import { amountInWords } from '../../../utils/amountInWords';
import { SAMPLE_DECLARATION_BAND, INVOICE_TYPES } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;
const { TextArea } = Input;

const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'INR'].map((c) => ({ value: c, label: c }));

/**
 * Step 4 — declaration, totals and bank, type-aware (R2). COMMERCIAL prints
 * the fixed NOT-FOR-SALE band + customs declaration; SAMPLE (chargeable) has
 * NO band and uses the actual-price declaration (ref SA011). Both paragraphs
 * live in the Company Profile so the CHA can revert wording without a code
 * change (OQ3). Amount in words is auto-generated — never typed.
 */
const InvoiceStepDeclaration = ({ inv, patch, profile, totals, locked }) => {
  const isSample = inv.invoiceType === INVOICE_TYPES.SAMPLE;
  return (
  <Row gutter={24}>
    <Col xs={24} md={12}>
      {isSample ? (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="Chargeable invoice — no NOT-FOR-SALE band"
          description="The printed invoice shows the entered rates as the actual price with the declaration below. Recovery pricing guidance never prints."
        />
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Sample Declaration (fixed — prints in bold above the totals)</Text>
          <Input value={SAMPLE_DECLARATION_BAND} disabled style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: 600, marginBottom: 12 }} />
        </>
      )}
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
        {isSample
          ? 'Declaration Text (Company Master — actual-price wording)'
          : 'Declaration Text (Company Master — confirm wording with your clearing agent)'}
      </Text>
      <TextArea
        value={(isSample ? profile.extra?.declarationTextSample : profile.extra?.declarationText) || ''}
        disabled autoSize style={{ backgroundColor: 'var(--bg-tertiary)', marginBottom: 12 }}
      />
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
        Bank Details (Company Master{isSample ? ' — payment is expected against this invoice' : ''})
      </Text>
      <TextArea value={profile.bankBlock} disabled autoSize style={{ backgroundColor: 'var(--bg-tertiary)' }} />
    </Col>
    <Col xs={24} md={12}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Currency <Text type="danger">*</Text></Text>
          <Select
            style={{ width: '100%' }} value={inv.currency} disabled={locked}
            options={CURRENCY_OPTIONS} onChange={(v) => patch({ currency: v })}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>Defaults from the linked order</Text>
        </Col>
        <Col span={12}><Statistic title="Total Quantity" value={totals.totalQty} suffix="PCS" /></Col>
        <Col span={24}>
          <Statistic
            title="Total Declared Value"
            value={totals.declaredValue != null ? totals.declaredValue.toFixed(2) : '—'}
            prefix={totals.declaredValue != null ? inv.currency : ''}
          />
          {totals.ratesMissing && <Text type="danger" style={{ fontSize: 12 }}>⚠ Incomplete — a line has no rate</Text>}
        </Col>
        <Col span={24}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Amount in Words (auto-generated — never typed)</Text>
          <Input
            value={totals.declaredValue != null ? amountInWords(totals.declaredValue, inv.currency) : '—'}
            disabled style={{ backgroundColor: 'var(--bg-tertiary)' }}
          />
        </Col>
        <Col span={24}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Signatory</Text>
          <Input
            value={`For ${(profile.companyName || '').toUpperCase()} · ${profile.extra?.signatory || 'Authorised Signatory'}`}
            disabled style={{ backgroundColor: 'var(--bg-tertiary)' }}
          />
        </Col>
        {totals.ratesMissing && !locked && (
          <Col span={24}>
            <Alert
              type="error" showIcon
              message="Issue is blocked."
              description="A line has no rate. Issue assigns the invoice number, locks the document, and links it to its SRs."
            />
          </Col>
        )}
      </Row>
    </Col>
  </Row>
  );
};

export default InvoiceStepDeclaration;
