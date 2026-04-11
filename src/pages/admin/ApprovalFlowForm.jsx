import { useState, useEffect, useCallback, useContext } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Card,
  Space,
  Radio,
  Checkbox,
  Divider,
  Typography,
  Row,
  Col,
  message,
  Tag,
  Tooltip,
  App,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { getRoles } from '../../services/admin/roleService';
import { getUsers } from '../../services/admin/userService';
import {
  createApprovalFlow,
  updateApprovalFlow,
  getApprovalFlowById,
} from '../../services/core/approvalFlowService';
import {
  ENTITY_TYPES,
  APPROVER_TYPES,
  CONDITION_OPERATORS,
  CONDITION_FIELDS,
} from '../../utils/approvalFlowConstants';

const { Text, Title } = Typography;
const { TextArea } = Input;

const ApprovalFlowForm = ({ open, onClose, onSuccess, editingFlow }) => {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedEntityType, setSelectedEntityType] = useState(null);

  const isEditing = !!editingFlow;

  // Load roles and users for approver selection
  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      // Load roles and users independently — one failure shouldn't block the other
      try {
        const rolesData = await getRoles();
        setRoles(Array.isArray(rolesData) ? rolesData.filter(r => r.status === 'Active') : []);
      } catch (err) {
        console.error('Failed to load roles', err);
      }
      try {
        const usersData = await getUsers();
        const userList = Array.isArray(usersData) ? usersData : (usersData.content || usersData.data || []);
        setUsers(userList.filter(u => u.isActive !== false));
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    loadData();
  }, [open]);

  // Load flow data for editing
  useEffect(() => {
    if (!open) return;
    if (editingFlow) {
      setLoading(true);
      getApprovalFlowById(editingFlow.id)
        .then((flow) => {
          form.setFieldsValue({
            name: flow.name,
            entityType: flow.entityType,
            description: flow.description,
            priority: flow.priority,
            active: flow.active,
            conditions: flow.conditions?.length > 0 ? flow.conditions : [],
            levels: flow.levels?.map(l => ({
              levelName: l.levelName,
              approverType: l.approverType,
              approverRoleId: l.approverRoleId,
              approverUserId: l.approverUserId,
              allowReferBack: l.allowReferBack,
              allowReject: l.allowReject,
            })) || [{ approverType: 'ROLE', allowReferBack: true, allowReject: true }],
          });
          setSelectedEntityType(flow.entityType);
        })
        .catch(() => message.error('Failed to load flow details'))
        .finally(() => setLoading(false));
    } else {
      form.resetFields();
      form.setFieldsValue({
        active: true,
        priority: 0,
        conditions: [],
        levels: [{ approverType: 'ROLE', allowReferBack: true, allowReject: true }],
      });
      setSelectedEntityType(null);
    }
  }, [open, editingFlow, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        name: values.name,
        entityType: values.entityType,
        description: values.description,
        active: values.active ?? true,
        priority: values.priority ?? 0,
        conditions: values.conditions?.filter(c => c?.field && c?.operator) || [],
        levels: values.levels.map((l, idx) => ({
          levelNumber: idx + 1,
          levelName: l.levelName,
          approverType: l.approverType,
          approverRoleId: l.approverType === 'ROLE' ? l.approverRoleId : null,
          approverUserId: l.approverType === 'USER' ? l.approverUserId : null,
          allowReferBack: l.allowReferBack ?? true,
          allowReject: l.allowReject ?? true,
        })),
        version: editingFlow?.version,
      };

      if (isEditing) {
        await updateApprovalFlow(editingFlow.id, payload);
        message.success('Approval flow updated');
      } else {
        await createApprovalFlow(payload);
        message.success('Approval flow created');
      }
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return; // form validation error
      message.error(err.response?.data?.message || 'Failed to save approval flow');
    } finally {
      setSubmitting(false);
    }
  }, [form, isEditing, editingFlow, onSuccess]);

  const handleEntityTypeChange = useCallback((value) => {
    setSelectedEntityType(value);
    form.setFieldValue('conditions', []);
  }, [form]);

  const conditionFields = selectedEntityType ? (CONDITION_FIELDS[selectedEntityType] || []) : [];

  return (
    <Drawer
      title={isEditing ? 'Edit Approval Flow' : 'New Approval Flow'}
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        disabled={loading}
        initialValues={{
          active: true,
          priority: 0,
          conditions: [],
          levels: [{ approverType: 'ROLE', allowReferBack: true, allowReject: true }],
        }}
      >
        {/* ─── Basic Info ─── */}
        <Card size="small" title="Basic Info" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Flow Name"
                rules={[{ required: true, message: 'Enter flow name' }]}
              >
                <Input placeholder="e.g. PO Standard Approval" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="entityType"
                label="Entity Type"
                rules={[{ required: true, message: 'Select entity type' }]}
              >
                <Select
                  placeholder="Select entity type"
                  options={ENTITY_TYPES}
                  onChange={handleEntityTypeChange}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Describe when this flow applies" />
          </Form.Item>
          <Row gutter={[16, 0]}>
            <Col xs={12} md={8}>
              <Form.Item
                name="priority"
                label={
                  <Tooltip title="Higher priority flows are evaluated first. If conditions match, lower-priority flows are skipped.">
                    <Space size={4}>Priority <InfoCircleOutlined /></Space>
                  </Tooltip>
                }
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ─── Conditions ─── */}
        <Card
          size="small"
          title="Conditions"
          style={{ marginBottom: 16 }}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Leave empty to match all
            </Text>
          }
        >
          {conditionFields.length === 0 && selectedEntityType && (
            <Text type="secondary">No configurable conditions for this entity type.</Text>
          )}
          {!selectedEntityType && (
            <Text type="secondary">Select an entity type first to configure conditions.</Text>
          )}
          {conditionFields.length > 0 && (
            <Form.List name="conditions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={[8, 0]} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <Form.Item {...restField} name={[name, 'field']} noStyle>
                          <Select
                            placeholder="Field"
                            options={conditionFields.map(f => ({ value: f.value, label: f.label }))}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'operator']} noStyle>
                          <Select
                            placeholder="Op"
                            options={CONDITION_OPERATORS}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item {...restField} name={[name, 'value']} noStyle>
                          <InputNumber placeholder="Value" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 4 }}
                  >
                    Add Condition
                  </Button>
                  {fields.length > 1 && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                      All conditions must match (AND logic).
                    </Text>
                  )}
                </>
              )}
            </Form.List>
          )}
        </Card>

        {/* ─── Approval Levels ─── */}
        <Card size="small" title="Approval Levels">
          <Form.List
            name="levels"
            rules={[
              {
                validator: async (_, levels) => {
                  if (!levels || levels.length === 0) {
                    return Promise.reject(new Error('At least one approval level is required'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <Card
                    key={key}
                    size="small"
                    type="inner"
                    title={
                      <Space>
                        <Tag color="blue">Level {index + 1}</Tag>
                        <Form.Item
                          {...restField}
                          name={[name, 'levelName']}
                          noStyle
                        >
                          <Input
                            placeholder="Level name (e.g. Manager Approval)"
                            variant="borderless"
                            style={{ width: 250 }}
                          />
                        </Form.Item>
                      </Space>
                    }
                    extra={
                      fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                          size="small"
                        />
                      )
                    }
                    style={{ marginBottom: 12 }}
                  >
                    <Row gutter={[16, 0]}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'approverType']}
                          label="Approver Type"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Radio.Group>
                            {APPROVER_TYPES.map(t => (
                              <Radio.Button key={t.value} value={t.value}>
                                {t.label}
                              </Radio.Button>
                            ))}
                          </Radio.Group>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={16}>
                        <Form.Item noStyle shouldUpdate={(prev, curr) => {
                          const prevType = prev.levels?.[index]?.approverType;
                          const currType = curr.levels?.[index]?.approverType;
                          return prevType !== currType;
                        }}>
                          {({ getFieldValue }) => {
                            const type = getFieldValue(['levels', name, 'approverType']);
                            if (type === 'ROLE') {
                              return (
                                <Form.Item
                                  {...restField}
                                  name={[name, 'approverRoleId']}
                                  label="Role"
                                  rules={[{ required: true, message: 'Select a role' }]}
                                >
                                  <Select
                                    placeholder="Select role"
                                    showSearch
                                    optionFilterProp="label"
                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                  />
                                </Form.Item>
                              );
                            }
                            return (
                              <Form.Item
                                {...restField}
                                name={[name, 'approverUserId']}
                                label="User"
                                rules={[{ required: true, message: 'Select a user' }]}
                              >
                                <Select
                                  placeholder="Select user"
                                  showSearch
                                  optionFilterProp="label"
                                  options={users.map(u => ({ value: u.id, label: u.name }))}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={[16, 0]}>
                      <Col>
                        <Form.Item
                          {...restField}
                          name={[name, 'allowReferBack']}
                          valuePropName="checked"
                        >
                          <Checkbox>Allow Refer Back</Checkbox>
                        </Form.Item>
                      </Col>
                      <Col>
                        <Form.Item
                          {...restField}
                          name={[name, 'allowReject']}
                          valuePropName="checked"
                        >
                          <Checkbox>Allow Reject</Checkbox>
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ approverType: 'ROLE', allowReferBack: true, allowReject: true })}
                  block
                  icon={<PlusOutlined />}
                >
                  Add Approval Level
                </Button>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </Card>
      </Form>
    </Drawer>
  );
};

export default ApprovalFlowForm;
