import { useState } from 'react';
import {
  Card, Row, Col, Form, Select, InputNumber, Input, Segmented, Typography, Tag, Divider,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { SR_PRIORITY_OPTIONS } from '../../../utils/sampleRequestConstants';

const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * Section B — Sample Details (PRD v3 §8.2 B).
 * Sample Type is a CREATABLE combobox over the user-defined master: typing an
 * unknown name offers "Create new type" (written to Master Data, substitution
 * defaults to Not allowed). The Colour/Design Substitution toggle pre-fills
 * from the selected type's default and is overridable per SR — it drives the
 * Section D lock state.
 */
const SectionDetails = ({ form, sampleTypes, typesLoading = false, onCreateType, orderSizes, round }) => {
  const [typeSearch, setTypeSearch] = useState('');
  const substitution = Form.useWatch('colourSubstitutionAllowed', form);

  const exactMatch = sampleTypes.some((t) => t.name.toLowerCase() === typeSearch.trim().toLowerCase());
  const showCreate = typeSearch.trim() && !exactMatch;

  const options = sampleTypes.map((t) => ({
    value: t.id,
    label: (
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{t.name}</span>
        <Tag color={t.colourSubstitutionDefault ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
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
            rules={[{ required: true, message: 'Select or create a sample type' }]}
            tooltip="User-defined list — type a new name to create it (new types default to substitution Not allowed)"
          >
            <Select
              showSearch
              loading={typesLoading}
              placeholder="e.g. Fit — Revised"
              optionFilterProp="name"
              onSearch={setTypeSearch}
              options={options}
              onChange={(id) => {
                const type = sampleTypes.find((t) => t.id === id);
                if (type) {
                  // Pre-fill the per-SR override from the type default (PRD §9)
                  form.setFieldValue('colourSubstitutionAllowed', Boolean(type.colourSubstitutionDefault));
                }
              }}
              popupRender={(menu) => (
                <>
                  {menu}
                  {showCreate && (
                    <>
                      <Divider style={{ margin: '4px 0' }} />
                      <div
                        style={{ padding: '6px 12px', cursor: 'pointer', color: 'var(--primary-color)' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onCreateType(typeSearch.trim()); setTypeSearch(''); }}
                      >
                        <PlusOutlined /> Create new type &quot;{typeSearch.trim()}&quot;
                        <Text type="secondary" style={{ marginInlineStart: 8, fontSize: 11 }}>
                          saves to Master Data · defaults to Not allowed
                        </Text>
                      </div>
                    </>
                  )}
                </>
              )}
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
          <Form.Item name="specialInstructions" label={`Special Instructions${round > 1 ? ` (Round ${round})` : ''}`}>
            <TextArea rows={1} placeholder="Buyer-specific requirements" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default SectionDetails;
