import { useCallback, useMemo } from 'react';
import {
  Card, Row, Col, Form, Select, InputNumber, Input, Segmented, Typography, Tag, Alert, Space,
} from 'antd';
import { Link } from 'react-router-dom';
import {
  SR_PRIORITY_OPTIONS, SR_SCOPE, getSrStatusLabel, sampleTypeAvailability,
  srIdentityKey, srIsMaterial, srNamesAColour,
} from '../../../utils/sampleRequestConstants';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Section B — Sample Details.
 * Sample Type is a FIXED list of ten (Proto, Fit, Size Set, Photoshoot Sample,
 * PP Sample, Shipment Sample, SMS, Lab Dip, Strike Off, Others) — no
 * user-created types.
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
  form, sampleTypes, typesLoading = false, orderSizes, orderColours = [], materials = [],
  existingRequests = [], record = null,
}) => {
  const substitution = Form.useWatch('colourSubstitutionAllowed', form);
  // The selected type decides what the rest of this card asks for, so it has to
  // be watched rather than read once.
  const sampleTypeId = Form.useWatch('sampleTypeId', form);

  const scopeFor = useCallback(
    (id) => sampleTypes.find((t) => t.id === id)?.sampleScope || SR_SCOPE.ORDER_NO_COLOUR,
    [sampleTypes],
  );
  const scope = scopeFor(sampleTypeId);
  const isMaterial = srIsMaterial(scope);

  const taken = useMemo(
    () => sampleTypeAvailability(existingRequests, record?.id ?? null, scopeFor),
    [existingRequests, record, scopeFor],
  );
  const isRevision = Boolean(record?.parentSrId);
  const revisable = useMemo(
    () => [...taken.values()].filter((r) => r.canRaiseRevision),
    [taken],
  );

  /**
   * Every request this type could still be raised as, and which of them are
   * already taken. A per-colour type is only closed once every colourway has
   * one; a lab dip once every material does.
   */
  const coverage = useCallback((typeId) => {
    const s = scopeFor(typeId);
    let keys;
    if (s === SR_SCOPE.ORDER_PER_COLOUR) {
      keys = orderColours.map((c) => srIdentityKey(s, typeId, c, null));
    } else if (srIsMaterial(s)) {
      keys = materials.map((m) => srIdentityKey(s, typeId, m.colourDesign, m.bomLineId));
    } else {
      keys = [srIdentityKey(s, typeId, null, null)];
    }
    const holders = keys.map((k) => taken.get(k)).filter(Boolean);
    return { total: keys.length, holders, full: keys.length > 0 && holders.length === keys.length };
  }, [scopeFor, orderColours, materials, taken]);

  const options = sampleTypes.map((t) => {
    const { total, holders, full } = coverage(t.id);
    const holder = holders.length === 1 && total === 1 ? holders[0] : null;
    const partial = holders.length > 0 && !full;
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
          ) : partial ? (
            <Tag color="blue" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
              {holders.length} of {total} raised
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
      // Closed only when there is nothing left to raise it as. A per-colour type
      // with one colourway still free stays open.
      disabled: full,
    };
  });

  /** A colourway already sampled under this type, or undefined. */
  const colourHolder = (colour) => taken.get(srIdentityKey(scope, sampleTypeId, colour, null));

  const colourOptions = orderColours.map((c) => {
    const holder = colourHolder(c);
    return {
      value: c,
      name: c,
      label: holder ? (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>{c}</span>
          <Tag style={{ marginInlineEnd: 0, flexShrink: 0 }}>{holder.srNo} · {getSrStatusLabel(holder.status)}</Tag>
        </span>
      ) : c,
      // A courtesy, not the rule: tags mode still lets a colour be typed, and
      // the server answers with the request that holds it.
      disabled: Boolean(holder),
    };
  });

  const materialOptions = materials.map((m) => {
    const holder = taken.get(srIdentityKey(scope, sampleTypeId, m.colourDesign, m.bomLineId));
    const parts = (m.partsName || []).join(', ');
    const name = [parts, m.description, m.colourDesign].filter(Boolean).join(' · ');
    return {
      value: m.bomLineId,
      name,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          {holder && (
            <Tag style={{ marginInlineEnd: 0, flexShrink: 0 }}>{holder.srNo} · {getSrStatusLabel(holder.status)}</Tag>
          )}
        </span>
      ),
      disabled: Boolean(holder),
    };
  });

  /**
   * What this sample type asks for, which is the whole difference between the
   * four scopes. Proto and Fit ask for nothing; a size set for one colourway; a
   * PP sample for as many as the buyer wants a sample of; a lab dip for the
   * fabrics rather than the colours, because its colour comes off the BOM line.
   */
  const identityField = () => {
    if (!srNamesAColour(scope)) return null;

    if (isMaterial) {
      return (
        <Form.Item
          name="bomLineIds"
          label="Materials"
          rules={[{ required: true, message: 'Choose at least one material' }]}
          tooltip="A lab dip approves one fabric in one shade, and different fabrics take dye differently - so each material gets its own request. The colour comes from the BOM line."
          extra={materials.length === 0
            ? 'This BOM has no materials yet.'
            : 'One sample request is raised per material.'}
        >
          <Select
            mode="multiple"
            placeholder="Select materials"
            maxTagCount="responsive"
            optionFilterProp="name"
            options={materialOptions}
            disabled={materials.length === 0}
          />
        </Form.Item>
      );
    }

    if (scope === SR_SCOPE.ORDER_ONE_COLOUR) {
      return (
        <Form.Item
          name="colourName"
          label="Colourway"
          rules={[{ required: orderColours.length > 0, message: 'Choose the colourway' }]}
          tooltip="A size set proves grading across sizes, so it is made in one colourway of your choosing - there is still only one per order."
          extra={orderColours.length === 0 ? 'This order names no colourways.' : undefined}
        >
          <Select
            allowClear
            showSearch
            placeholder="Select colourway"
            optionFilterProp="name"
            options={colourOptions}
            disabled={orderColours.length === 0}
          />
        </Form.Item>
      );
    }

    return (
      <Form.Item
        name="colours"
        label="Colourways"
        rules={[{ required: orderColours.length > 0, message: 'Pick at least one colourway' }]}
        tooltip="One sample request is raised per colour, each with its own number and its own approval."
        extra={orderColours.length === 0
          ? 'This order names no colourways - add them on the order first.'
          : 'One sample request is raised per colour.'}
      >
        {/* tags, not multiple: a shade still under development is a real ask. */}
        <Select
          mode="tags"
          placeholder="Select colourways"
          maxTagCount="responsive"
          optionFilterProp="name"
          options={colourOptions}
        />
      </Form.Item>
    );
  };

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
        <Col xs={24} sm={12} md={8} lg={5}>
          {identityField()}
        </Col>
        <Col xs={24} sm={12} md={8} lg={3}>
          <Form.Item
            name="sampleQty"
            label={isMaterial ? 'Swatches' : 'Sample Quantity'}
            rules={[{ required: true, message: isMaterial ? 'Enter how many swatches' : 'Enter quantity per size' }]}
            extra={isMaterial ? 'Swatches per material' : 'Pieces per size'}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 2" />
          </Form.Item>
        </Col>
        {/* A lab dip is a card of swatches, not garments - there is no size run
            to give, and the server does not ask for one either. */}
        {!isMaterial && (
          <Col xs={24} sm={12} md={8} lg={4}>
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
        )}
      </Row>
      {/* A disabled option cannot carry a link, so the way to a re-make sits under the field. */}
      {!isRevision && revisable.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Some sample types on this order are waiting to be re-made"
          description={(
            <Space orientation="vertical" size={2}>
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
