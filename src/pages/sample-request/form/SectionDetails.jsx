import {
  Card, Row, Col, Form, Select, InputNumber, Input, Segmented, Typography, Tag,
} from 'antd';
import { SR_PRIORITY_OPTIONS } from '../../../utils/sampleRequestConstants';

const { Title } = Typography;
const { TextArea } = Input;

/**
 * Section B — Sample Details (R2).
 * Sample Type is a FIXED list of eight (Proto, Fit, Size Set, Photoshoot
 * Sample, PP Sample, Shipment Sample, SMS, Others) — no user-created types.
 * The Colour/Design Substitution toggle pre-fills from the selected type's
 * default and is overridable per SR — it drives the Section D lock state.
 */
const SectionDetails = ({ form, sampleTypes, typesLoading = false, orderSizes }) => {
  const substitution = Form.useWatch('colourSubstitutionAllowed', form);

  const options = sampleTypes.map((t) => ({
    value: t.id,
    // alignItems centres the tag against the text — without it the tag
    // stretches to the control height and its label rides high
    label: (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        <Tag
          color={t.colourSubstitutionDefault ? 'green' : 'default'}
          style={{ marginInlineEnd: 0, flexShrink: 0 }}
        >
          {t.colourSubstitutionDefault ? 'Substitution: Allowed' : 'Substitution: Not allowed'}
        </Tag>
      </span>
    ),
    name: t.name,
  }));

  return (
    <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>B · Sample Details</Title>}>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Form.Item
            name="sampleTypeId"
            label="Sample Type"
            rules={[{ required: true, message: 'Select a sample type' }]}
            tooltip="Fixed list — Proto, Fit, Size Set, Photoshoot Sample, PP Sample, Shipment Sample, SMS, Others"
          >
            <Select
              showSearch
              loading={typesLoading}
              placeholder="Select sample type"
              optionFilterProp="name"
              options={options}
              onChange={(id) => {
                const type = sampleTypes.find((t) => t.id === id);
                if (type) {
                  // Pre-fill the per-SR override from the type default
                  form.setFieldValue('colourSubstitutionAllowed', Boolean(type.colourSubstitutionDefault));
                }
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Form.Item
            name="colourSubstitutionAllowed"
            label="Colour / Design Substitution"
            rules={[{ required: true, message: 'Choose substitution rule' }]}
            tooltip="Pre-filled from the selected type's default. Overridable on this SR only — the Master Data default is unchanged. Drives the Section D table lock state."
            normalize={(v) => Boolean(v)}
          >
            <Segmented
              options={[
                { label: 'Allowed', value: true },
                { label: 'Not allowed', value: false },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Form.Item
            name="sampleQty"
            label="Sample Quantity"
            rules={[{ required: true, message: 'Enter quantity per size' }]}
            extra="Pieces per size"
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 2" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8}>
          <Form.Item
            name="sizes"
            label="Sizes"
            rules={[{ required: true, message: 'Select sizes' }]}
            extra="From size presets on the linked order"
          >
            <Select
              mode="tags"
              placeholder="Select sizes"
              options={orderSizes.map((s) => ({ value: s, label: s }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={10} lg={8}>
          <Form.Item
            name="colourReference"
            label="Colour / Print Reference"
            extra={substitution
              ? 'Substitution allowed — any available colour acceptable.'
              : 'Locked rule — sample must match this reference.'}
          >
            <Input placeholder="e.g. Pantone 19-4052 Classic Blue" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Form.Item name="priority" label="Priority" rules={[{ required: true, message: 'Select priority' }]}>
            <Select options={SR_PRIORITY_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8} lg={12}>
          <Form.Item name="specialInstructions" label="Special Instructions">
            <TextArea rows={1} placeholder="Buyer-specific requirements" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default SectionDetails;
