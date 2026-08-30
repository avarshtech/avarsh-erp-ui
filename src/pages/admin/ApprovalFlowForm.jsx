import { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Form, Input, Select, InputNumber, Switch, Button, Card, Space,
  Typography, Row, Col, Tooltip, App,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { getRoles } from '../../services/admin/roleService';
import { getUsers } from '../../services/admin/userService';
import {
  createApprovalFlow, updateApprovalFlow, getApprovalFlowById,
} from '../../services/core/approvalFlowService';
import { FLOW_ENTITY_TYPE_OPTIONS } from '../../utils/approvalFlowConstants';
import FlowSummaryPreview from './components/FlowSummaryPreview';
import FlowConditionEditor from './components/FlowConditionEditor';
import FlowLevelPipeline from './components/FlowLevelPipeline';
import FlowLockedBanner from './components/FlowLockedBanner';

const { Text } = Typography;
const { TextArea } = Input;

const DEFAULT_LEVEL = { approverType: 'ROLE', allowReferBack: true, allowReject: true };

const ApprovalFlowForm = ({ open, onClose, onSuccess, editingFlow, onSwitchFlow }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadedFlow, setLoadedFlow] = useState(null);
  const entityType = Form.useWatch('entityType', form);

  const isEditing = !!editingFlow;
  // Levels of a flow with request history are read-only (audit-trail protection).
  const locked = isEditing && !!(loadedFlow ?? editingFlow)?.hasHistory;

  useEffect(() => {
    if (!open) return;
    // Load roles and users independently — one failure shouldn't block the other
    getRoles()
      .then((data) => setRoles(Array.isArray(data) ? data.filter((r) => r.status !== 'INACTIVE') : []))
      .catch((err) => console.error('Failed to load roles', err));
    getUsers()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.content || data.data || []);
        setUsers(list.filter((u) => u.isActive !== false));
      })
      .catch((err) => console.error('Failed to load users', err));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadedFlow(null);
    if (editingFlow) {
      setLoading(true);
      getApprovalFlowById(editingFlow.id)
        .then((flow) => {
          setLoadedFlow(flow);
          form.setFieldsValue({
            name: flow.name,
            entityType: flow.entityType,
            description: flow.description,
            priority: flow.priority,
            active: flow.active,
            preventSelfApproval: flow.preventSelfApproval ?? false,
            conditions: flow.conditions?.length > 0 ? flow.conditions : [],
            levels: flow.levels?.map((l) => ({
              levelName: l.levelName,
              approverType: l.approverType,
              approverRoleId: l.approverRoleId,
              approverUserId: l.approverUserId,
              allowReferBack: l.allowReferBack,
              allowReject: l.allowReject,
            })) || [DEFAULT_LEVEL],
          });
        })
        .catch(() => message.error('Failed to load flow details'))
        .finally(() => setLoading(false));
    } else {
      form.resetFields();
      form.setFieldsValue({
        active: true, priority: 0, preventSelfApproval: false, conditions: [], levels: [DEFAULT_LEVEL],
      });
    }
  }, [open, editingFlow, form, message]);

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
        preventSelfApproval: values.preventSelfApproval ?? false,
        conditions: values.conditions?.filter((c) => c?.field && c?.operator) || [],
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
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save approval flow');
    } finally {
      setSubmitting(false);
    }
  }, [form, isEditing, editingFlow, onSuccess, message]);

  return (
    <Drawer
      title={isEditing ? 'Edit Approval Flow' : 'New Approval Flow'}
      open={open}
      onClose={onClose}
      width={1000}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      {locked && <FlowLockedBanner flow={loadedFlow ?? editingFlow} onCloned={onSwitchFlow} />}
      <Form form={form} layout="vertical" disabled={loading}>
        <FlowSummaryPreview roles={roles} users={users} />
        <Card size="small" title="Basic Info" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Flow Name" rules={[{ required: true, message: 'Enter flow name' }]}>
                <Input placeholder="e.g. PO Standard Approval" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="entityType" label="Entity Type" rules={[{ required: true, message: 'Select entity type' }]}>
                <Select
                  placeholder="Select entity type"
                  options={FLOW_ENTITY_TYPE_OPTIONS}
                  disabled={locked}
                  onChange={() => form.setFieldValue('conditions', [])}
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
            <Col xs={24} md={8}>
              <Form.Item
                name="preventSelfApproval"
                valuePropName="checked"
                label={
                  <Tooltip title="When on, the user who submitted the request cannot approve/reject it — even if they match the approver level.">
                    <Space size={4}>Prevent Self-Approval <InfoCircleOutlined /></Space>
                  </Tooltip>
                }
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>
        <Card
          size="small"
          title="Conditions"
          style={{ marginBottom: 16 }}
          extra={<Text type="secondary" style={{ fontSize: 12 }}>Leave empty to match all</Text>}
        >
          <FlowConditionEditor entityType={entityType} />
        </Card>
        <Card size="small" title="Approval Levels">
          <FlowLevelPipeline roles={roles} users={users} disabled={locked} />
        </Card>
      </Form>
    </Drawer>
  );
};

export default ApprovalFlowForm;
