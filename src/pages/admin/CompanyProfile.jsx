import { useState, useEffect, useCallback } from 'react';
import { App, Card, Form, Input, Row, Col, Skeleton, Alert, Space } from 'antd';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import { hasPermission } from '../../utils/permissions';
import { toastUnlessHandled } from '../../utils/apiError';
import { getActiveOrganisation, saveOrganisation } from '../../services/admin/organisationService';

const MODULE_ID = 'company-profile';
const { TextArea } = Input;

const Section = ({ title, extra, children }) => (
  <Card size="small" title={title} extra={extra} style={{ marginBottom: 16 }}>
    <Row gutter={16}>{children}</Row>
  </Card>
);

const Field = ({ name, label, span = 8, extra, children }) => (
  <Col xs={24} md={span}>
    <Form.Item name={name} label={label} extra={extra}>{children || <Input />}</Form.Item>
  </Col>
);

/**
 * The exporter's own record — one row, edited in place. Every export document
 * prints from it: the exporter and bank blocks on a sample invoice, the IEC and
 * signatory, the declaration wording, and the two invoice number series.
 *
 * The country here is also what decides whether a buyer counts as overseas, so
 * an unconfigured profile makes every dispatch look domestic — hence the banner.
 */
const CompanyProfile = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission(MODULE_ID, org ? 'update' : 'add');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = await getActiveOrganisation();
      setOrg(active);
      form.setFieldsValue(active || { commercialInvoiceSeries: 'EXSG', sampleInvoiceSeries: 'SA' });
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load the company profile');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      // version rides along so a profile edited in another tab conflicts
      // rather than silently overwriting
      const saved = await saveOrganisation(org?.id, { ...values, version: org?.version, isActive: true });
      setOrg(saved);
      form.setFieldsValue(saved);
      message.success('Company profile saved');
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save the company profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>;

  return (
    <div>
      <PageHeader title="Company Profile" subtitle="The exporter record every invoice and export document prints from">
        {canEdit && (
          <ActionButton action="save" text="Save Profile" loading={saving} onClick={() => form.submit()} />
        )}
      </PageHeader>

      {!org && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No company profile configured"
          description="Until this is saved, buyers cannot be told apart as domestic or overseas, and a sample invoice cannot be issued — its number series comes from here."
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={!canEdit}>
        <Section title="Identity">
          <Field name="organisationName" label="Company Name" span={12} />
          <Field name="gstin" label="GSTIN" />
          <Field name="pan" label="PAN" />
          <Field name="cin" label="CIN" />
          <Field name="phone" label="Phone" />
          <Field name="email" label="Email" />
          <Field name="website" label="Website" />
        </Section>

        <Section title="Address" extra="Country decides which buyers count as overseas">
          <Field name="addressLine1" label="Address Line 1" span={12} />
          <Field name="addressLine2" label="Address Line 2" span={12} />
          <Field name="city" label="City" />
          <Field name="state" label="State" />
          <Field name="stateCode" label="State Code" />
          <Field name="pincode" label="Pincode" />
          <Field name="country" label="Country" />
        </Section>

        <Section title="Bank">
          <Field name="bankName" label="Bank Name" span={12} />
          <Field name="bankBranch" label="Branch" span={12} />
          <Field name="bankAccountNumber" label="Account Number" />
          <Field name="bankIfscCode" label="IFSC Code" />
          <Field name="swiftCode" label="SWIFT Code" extra="prints on export invoices for inward remittance" />
        </Section>

        <Section title="Export & Invoicing">
          <Field name="iecNumber" label="IEC Number" extra="Importer Exporter Code, printed as Exporter's Ref." />
          <Field name="authorisedSignatory" label="Authorised Signatory" extra="name printed above the signature block" />
          <Col xs={24} md={8} />
          <Field name="commercialInvoiceSeries" label="Commercial Invoice Series" extra="prefix for the export/customs invoice that ships a free-of-charge sample" />
          <Field name="sampleInvoiceSeries" label="Sample Invoice Series" extra="prefix for the chargeable sample invoice the buyer pays against" />
          <Col xs={24} md={8} />
          <Field
            name="declarationTextCommercial"
            label="Declaration — Commercial Invoice"
            span={12}
            extra="the free-of-charge / value-for-customs wording"
          >
            <TextArea rows={4} maxLength={1000} showCount />
          </Field>
          <Field
            name="declarationTextSample"
            label="Declaration — Sample Invoice"
            span={12}
            extra="the actual-price wording"
          >
            <TextArea rows={4} maxLength={1000} showCount />
          </Field>
        </Section>
      </Form>

      {!canEdit && (
        <Space style={{ marginTop: 8 }}>
          <Alert type="info" showIcon message="You have read-only access to the company profile." />
        </Space>
      )}
    </div>
  );
};

export default CompanyProfile;
