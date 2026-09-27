import { App, Col, Form, Row, Select } from 'antd';
import CreatableSelect from '../CreatableSelect';
import { canCreateClassifiers } from '../quickCreateTypes';
import { NEW } from './itemGuess';

const CLASSIFIER_HINT = 'Creating a sub-category or item type needs "Master Data → Add" permission. Ask an admin.';

const withPending = (options, pendingName) =>
  (pendingName ? [...options, { value: NEW, label: `${pendingName} (new)` }] : options);

/**
 * Category › Sub-category › Item type. A missing sub-category or item type can be named right
 * here (it is created with the material), so a category with nothing under it is no longer a
 * dead end. The parent watches the values and passes the resolved records in.
 */
export default function ClassifierFields({ form, categories, category, sub, isNewSub, isNewType, newSubName, newTypeName }) {
  const { message } = App.useApp();
  const allowNew = canCreateClassifiers();

  const subOptions = withPending((category?.subCategories || []).map((s) => ({ value: s.id, label: s.name })), newSubName);
  const typeOptions = withPending(isNewSub ? [] : (sub?.itemTypes || []).map((t) => ({ value: t.id, label: t.name })), newTypeName);

  const createType = (text) => {
    if (!/^[A-Za-z0-9 ]+$/.test(text)) {
      message.warning('Item type names may contain only letters, digits and spaces.');
      return;
    }
    form.setFieldsValue({ itemTypeId: NEW, newItemTypeName: text });
  };

  return (
    <Row gutter={12}>
      <Form.Item name="newSubCategoryName" hidden noStyle />
      <Form.Item name="newItemTypeName" hidden noStyle />
      <Col span={8}>
        <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: 'Pick a category' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={() => form.setFieldsValue({
              subCategoryId: undefined, itemTypeId: undefined, newSubCategoryName: undefined, newItemTypeName: undefined,
            })}
          />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="subCategoryId" label="Sub-category" rules={[{ required: true, message: 'Pick or name one' }]}>
          <CreatableSelect
            options={subOptions} disabled={!category} createLabel="New sub-category"
            canCreate={allowNew} createHint={CLASSIFIER_HINT}
            onChange={() => form.setFieldsValue({ itemTypeId: undefined, newItemTypeName: undefined })}
            onCreate={(text) => form.setFieldsValue({
              subCategoryId: NEW, newSubCategoryName: text, itemTypeId: undefined, newItemTypeName: undefined,
            })}
          />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="itemTypeId" label="Item Type" rules={[{ required: true, message: 'Pick or name one' }]}
          extra={isNewSub && !isNewType ? 'A new sub-category needs a new item type.' : undefined}>
          <CreatableSelect
            options={typeOptions} disabled={!sub && !isNewSub} createLabel="New item type"
            canCreate={allowNew} createHint={CLASSIFIER_HINT} onCreate={createType}
          />
        </Form.Item>
      </Col>
    </Row>
  );
}
