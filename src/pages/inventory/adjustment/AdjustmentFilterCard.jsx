import { memo, useMemo } from 'react';
import { Card, Form, Select, Row, Col } from 'antd';

const toOpts = (list) => (list || []).map((x) => ({ value: x.id, label: x.name }));

const AdjustmentFilterCard = memo(function AdjustmentFilterCard({ metaData = [], value, onChange, disabled = false, loading = false }) {
  const { categoryId, subCategoryId, itemTypeId } = value || {};

  const subCategories = useMemo(
    () => metaData.find((c) => c.id === categoryId)?.subCategories || [],
    [metaData, categoryId],
  );
  const itemTypes = useMemo(
    () => subCategories.find((s) => s.id === subCategoryId)?.itemTypes || [],
    [subCategories, subCategoryId],
  );

  const handleCategoryChange = (id) => onChange?.({ categoryId: id, subCategoryId: undefined, itemTypeId: undefined });
  const handleSubCategoryChange = (id) => onChange?.({ categoryId, subCategoryId: id, itemTypeId: undefined });
  const handleItemTypeChange = (id) => onChange?.({ categoryId, subCategoryId, itemTypeId: id });

  return (
    <Card title="Filter Items" size="small" style={{ marginBottom: 24 }}>
      <Form layout="vertical">
        <Row gutter={24}>
          <Col xs={24} md={8}>
            <Form.Item label="Category" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select category"
                value={categoryId}
                onChange={handleCategoryChange}
                options={toOpts(metaData)}
                disabled={disabled}
                loading={loading}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Sub-Category" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select sub-category"
                value={subCategoryId}
                onChange={handleSubCategoryChange}
                options={toOpts(subCategories)}
                disabled={disabled || !categoryId}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Item Type" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Select item type"
                value={itemTypeId}
                onChange={handleItemTypeChange}
                options={toOpts(itemTypes)}
                disabled={disabled || !subCategoryId}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
});

export default AdjustmentFilterCard;
