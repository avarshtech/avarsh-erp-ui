import { useMemo } from 'react';
import {
  Card, Row, Col, Form, Select, InputNumber, Input, Segmented, Typography, Tag, Alert, Space,
} from 'antd';
import { Link } from 'react-router-dom';
import {
  SR_PRIORITY_OPTIONS, getSrStatusLabel, sampleTypeAvailability,
} from '../../../utils/sampleRequestConstants';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Section B — Sample Details.
 * Sample Type is a FIXED list of eight (Proto, Fit, Size Set, Photoshoot
 * Sample, PP Sample, Shipment Sample, SMS, Others) — no user-created types.
 * The Colour/Design Substitution toggle pre-fills from the selected type's
 * default and is overridable per SR — it drives the Section D lock state.
 *
 * An order carries one sample of each type at a time, so a type this BOM
 * already has is disabled here with the request that holds it — the server
 * would refuse the save, and a disabled option is cheaper than a 409. A type
 * whose sample was rejected is re-made as a revision of that request, never as
 * a new one, so the field points there instead. A revision itself keeps the
 * type of the request it re-makes, and the field is locked.
 */
const SectionDetails = ({
  form, sampleTypes, typesLoading = false, orderSizes, existingRequests = [], record = null,
}) => {
  const substitution = Form.useWatch('colourSubstitutionAllowed', form);

  const taken = useMemo(
    () => sampleTypeAvailability(existingRequests, record?.id ?? null),
    [existingRequests, record],
  );
  const isRevision = Boolean(record?.parentSrId);
  const revisable = useMemo(
    () => [...taken.values()].filter((r) => r.canRaiseRevision),
    [taken],
  );

  const options = sampleTypes.map((t) => {
    const holder = taken.get(t.id);
    return {
      value: t.id,
      // alignItems centres the tag against the text — without it the tag
      // stretches to the control height and its label rides high
      label: (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
          {holder ? (
            <Tag style={{ marginInlineEnd: 0, flexShrink: 0 }}>
              {holder.srNo} · {getSrStatusLabel(holder.status)}
            </Tag>
          ) : (
            <Tag
              color={t.colourSubstitutionDefault ? 'green' : 'default'}
              style={{ marginInlineEnd: 0, flexShrink: 0 }}
            >
              {t.colourSubstitutionDefault ? 'Substitution: Allowed' : 'Substitution: Not allowed'}
            </Tag>
          )}
        </span>
      ),
      name: t.name,
      disabled: Boolean(holder),
    };
  });

  return (
    <Card size="small" style={{ marginBottom: 16 }} title={<Title level={5} style={{ margin: 0 }}>B · Sample Details</Title>}>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Form.Item
            name="sampleTypeId"
            label="Sample Type"
            rules={[{ required: true, message: 'Select a sample type' }]}
            tooltip={isRevision
              ? `A revision keeps the sample type of ${record.parentSrNo}, the request it re-makes`
              : 'Fixed list — Proto, Fit, Size Set, Photoshoot Sample, PP Sample, Shipment Sample, SMS, Others. One of each per order at a time.'}
          >
            <Select
              showSearch
              loading={typesLoading}
              disabled={isRevision}
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
      {/* A disabled option cannot carry a link, so the way to a re-make sits under the field. */}
      {!isRevision && revisable.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Some sample types on this order are waiting to be re-made"
          description={(
            <Space direction="vertical" size={2}>
              {revisable.map((r) => (
                <Text key={r.id}>
                  {r.sampleTypeName} — {r.srNo} was {getSrStatusLabel(r.status).toLowerCase()}.
                  {' '}Raise a revision from{' '}
                  <Link to={`/sample-requests/list?viewId=${r.id}`}>{r.srNo}</Link>
                  {' '}rather than a new request.
                </Text>
              ))}
            </Space>
          )}
        />
      )}
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
