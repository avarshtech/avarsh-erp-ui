import { Col, Form, Input, Row, Switch } from 'antd';
import { IdcardOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import { normalName } from './roleGuards';

/**
 * A new or changed name: letters and spaces, at least 2, and no other role's name ignoring case
 * and spaces. An unchanged name is not judged again — a legacy one that breaks these rules must
 * not stop a role from being saved, least of all while users hold it and its name is fixed.
 */
const nameRule = (initialName, takenNames) => ({
  validator: (_, value) => {
    if (!value || value === initialName) return Promise.resolve();
    if (!/^[a-zA-Z\s]+$/.test(value)) return Promise.reject(new Error('Use letters and spaces only'));
    if (value.trim().length < 2) return Promise.reject(new Error('Use at least 2 characters'));
    if (takenNames.has(normalName(value))) return Promise.reject(new Error('Another role already has this name'));
    return Promise.resolve();
  },
});

/**
 * The role's own fields, in one row. The name is required, at most 50 characters (the column's
 * size), and fixed while users hold the role, because the API refuses the rename. The description
 * is at most 50 characters too.
 */
const RoleDetailsCard = ({ form, initialValues, renameReason, takenNames }) => (
  <DetailCard title="Role details" icon={<IdcardOutlined />} bare style={{ marginBottom: 16 }}>
    <Form form={form} layout="vertical" initialValues={initialValues}>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="name"
            label="Role name"
            extra={renameReason ?? undefined}
            rules={[
              { required: true, message: 'Enter a role name' },
              { max: 50, message: 'Use at most 50 characters' },
              nameRule(initialValues.name, takenNames),
            ]}
          >
            <Input disabled={Boolean(renameReason)} />
          </Form.Item>
        </Col>
        <Col xs={24} md={4}>
          <Form.Item name="active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="description" label="Description">
            <Input maxLength={50} showCount />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </DetailCard>
);

export default RoleDetailsCard;
