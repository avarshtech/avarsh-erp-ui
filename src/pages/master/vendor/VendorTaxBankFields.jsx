import { Checkbox, Col, Divider, Form, Input, Row } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { GSTIN_REGEX, IFSC_REGEX, PAN_REGEX, SWIFT_REGEX, toIdentifier } from '../../../utils/partyValidation';

const DIVIDER = { fontSize: 13, fontWeight: 600 };

/**
 * Tax, terms and bank. GSTIN and PAN are required, as on the Supplier master; the terms and bank
 * details are optional and checked only when filled. A GSTIN must be unique among active vendors; the
 * API refuses a second one.
 */
const VendorTaxBankFields = () => (
  <>
    <Divider titlePlacement="start" style={DIVIDER}>Tax &amp; Terms</Divider>
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item name="gstin" label="GSTIN" normalize={toIdentifier(15)}
          rules={[{ required: true, message: 'GSTIN is required' },
            { pattern: GSTIN_REGEX, message: 'Invalid GSTIN format (e.g., 33AAPFS1234K1Z9)' }]}
          tooltip="One active vendor per GSTIN.">
          <Input placeholder="e.g., 33AAPFS1234K1Z9" maxLength={15} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="pan" label="PAN" normalize={toIdentifier(10)}
          rules={[{ required: true, message: 'PAN is required' },
            { pattern: PAN_REGEX, message: 'Invalid PAN format (e.g., AAPFS1234K)' }]}>
          <Input placeholder="e.g., AAPFS1234K" maxLength={10} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Tax Settings">
          <Form.Item name="igstApplicable" valuePropName="checked" noStyle>
            <Checkbox>IGST Applicable</Checkbox>
          </Form.Item>
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="paymentTerms" label="Payment Terms"
          tooltip="A job-work PO takes these as its own when they name a Payment Terms entry.">
          <Input placeholder="e.g., Open Account 30 Days" maxLength={100} />
        </Form.Item>
      </Col>
    </Row>

    <Divider titlePlacement="start" style={DIVIDER}><BankOutlined style={{ marginRight: 6 }} />Bank Details</Divider>
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item name="bankName" label="Bank Name">
          <Input placeholder="Bank name" maxLength={100} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="bankAccountNumber" label="Account Number" normalize={(value) => value?.replace(/[^0-9]/g, '').slice(0, 30)}>
          <Input placeholder="Account number" maxLength={30} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="bankBranch" label="Branch">
          <Input placeholder="Branch" maxLength={100} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="ifscCode" label="IFSC Code" normalize={toIdentifier(11)}
          rules={[{ pattern: IFSC_REGEX, message: 'Invalid IFSC format (e.g., SBIN0001234)' }]}>
          <Input placeholder="e.g., SBIN0001234" maxLength={11} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item name="swiftCode" label="SWIFT Code" normalize={toIdentifier(11)}
          rules={[{ pattern: SWIFT_REGEX, message: 'Invalid SWIFT format (e.g., SBININBB)' }]}>
          <Input placeholder="e.g., SBININBB" maxLength={11} />
        </Form.Item>
      </Col>
    </Row>
  </>
);

export default VendorTaxBankFields;
