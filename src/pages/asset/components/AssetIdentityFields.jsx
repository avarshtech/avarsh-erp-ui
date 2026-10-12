import { Col, Form, Input, Row, Select } from 'antd';
import { ASSET_CONDITION, ASSET_STATUS, EDITABLE_STATUSES, toOptions } from '../../../utils/assetConstants';

const STATUS_OPTIONS = toOptions(ASSET_STATUS, EDITABLE_STATUSES);
const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);

/** What the asset is: category, make, serial, and the state it is in. */
const AssetIdentityFields = ({ categoryOptions, subCategoryOptions, categoryLocked }) => (
  <Row gutter={16}>
    <Col xs={24} sm={12} md={8}>
      <Form.Item
        name="categoryId"
        label="Category"
        tooltip="Decides the asset ID and which extra fields appear below, so it cannot change later."
        rules={[{ required: true, message: 'Pick the category' }]}
      >
        <Select
          disabled={categoryLocked}
          showSearch
          optionFilterProp="label"
          placeholder="Select category"
          options={categoryOptions}
        />
      </Form.Item>
    </Col>
    {subCategoryOptions.length > 0 && (
      <Col xs={24} sm={12} md={8}>
        <Form.Item name="subCategoryId" label="Sub-category">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Select sub-category" options={subCategoryOptions} />
        </Form.Item>
      </Col>
    )}
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="name" label="Asset name" rules={[{ required: true, message: 'Name the asset' }]}>
        <Input maxLength={100} placeholder="e.g. Juki DDL-8700 single needle" />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="brand" label="Brand">
        <Input maxLength={50} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="model" label="Model">
        <Input maxLength={50} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="manufacturer" label="Manufacturer">
        <Input maxLength={100} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="serialNo" label="Serial no." tooltip="The manufacturer's number. No two assets may share one.">
        <Input maxLength={50} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="tagNo" label="Tag no." tooltip="Your own sticker or plate number, if the asset already carries one.">
        <Input maxLength={30} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Pick the status' }]}>
        <Select placeholder="Select status" options={STATUS_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="condition" label="Condition" rules={[{ required: true, message: 'Pick the condition' }]}>
        <Select placeholder="Select condition" options={CONDITION_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24}>
      <Form.Item name="remarks" label="Remarks">
        <Input.TextArea rows={2} maxLength={500} showCount />
      </Form.Item>
    </Col>
  </Row>
);

export default AssetIdentityFields;
