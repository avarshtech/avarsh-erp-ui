import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, InputNumber, Button, Space, App, Tag, Switch, Typography, Row, Col, Divider, Select, Alert } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../utils/inputHelpers';

const { Text } = Typography;
import { getAllProcesses, createProcess, updateProcess, deleteProcess } from '../../services/master/processService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'process-master';

/**
 * Process categories — the category alone decides which module consumes the process
 * and, consequently, which defaults the form collects.
 *
 *   Manufacturing → cost sheet Section D. Carries a default cost only; the cost sheet
 *                   auto-fills the manufacturing row from it.
 *   Fabric        → BOM fabric lines.  ┐ Carry the four allowance defaults, which
 *   Trims         → BOM trims lines.   ┘ ProcessAllowanceModal seeds to derive
 *                   purchase qty. A fabric line offers only Fabric processes, a trims
 *                   line only Trims processes.
 *
 * Cost sheet Section E (Overhead / Markup) is NOT a consumer of this master — its rows
 * come from the separate Overhead master (mst_overheads), so there is no Overheads
 * category here.
 *
 * These are the exact values the consumers query, so they must not be sourced from the
 * item-category master.
 */
const CATEGORY_OPTIONS = [
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Fabric', label: 'Fabric' },
  { value: 'Trims', label: 'Trims' },
];

/** Manufacturing is cost-bearing; Fabric and Trims are allowance-bearing. */
const isCostCategory = (category) => category === 'Manufacturing';

const ProcessMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllProcesses();
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
      setFilteredData(list);
    } catch {
      message.error('Failed to load processes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: 'Process Name',
      dataIndex: 'processName',
      sorter: (a, b) => (a.processName || '').localeCompare(b.processName || ''),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 100,
      render: (val) => val ? <Tag>{val}</Tag> : <Tag color="default">—</Tag>,
    },
    {
      title: 'Type',
      width: 90,
      render: (_, record) => {
        if (!record.category) return <Tag color="default">—</Tag>;
        return isCostCategory(record.category)
          ? <Tag color="blue">Cost</Tag>
          : <Tag color="purple">Allowance</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 90,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  const handleAdd = () => {
    if (!canAdd) { message.warning('You do not have permission to add processes'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true, category: null, defaultCost: null, defaultShrinkageInches: 0.00, defaultProcessLossPercent: 0.00, defaultRejectionPercent: 0.00, defaultShipmentAllowancePercent: 0.00 });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) { message.warning('You do not have permission to view processes'); return; }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) { message.warning('You do not have permission to update processes'); return; }
    if (!selectedId && !canAdd) { message.warning('You do not have permission to add processes'); return; }

    setSubmitting(true);
    try {
      // The category decides which set of defaults is meaningful; the other set is
      // zeroed so a process can never carry both a cost and an allowance. Blank inputs
      // are coerced to 0 because every default_* column is NOT NULL.
      const payload = { ...values };
      if (isCostCategory(values.category)) {
        payload.defaultCost = values.defaultCost ?? 0;
        payload.defaultShrinkageInches = 0;
        payload.defaultProcessLossPercent = 0;
        payload.defaultRejectionPercent = 0;
        payload.defaultShipmentAllowancePercent = 0;
      } else {
        payload.defaultCost = 0;
        payload.defaultShrinkageInches = values.defaultShrinkageInches ?? 0;
        payload.defaultProcessLossPercent = values.defaultProcessLossPercent ?? 0;
        payload.defaultRejectionPercent = values.defaultRejectionPercent ?? 0;
        payload.defaultShipmentAllowancePercent = values.defaultShipmentAllowancePercent ?? 0;
      }
      if (selectedId) {
        const selectedRecord = data.find(p => p.id === selectedId);
        await updateProcess(selectedId, { ...payload, version: selectedRecord?.version });
        message.success('Process updated successfully');
      } else {
        await createProcess(payload);
        message.success('Process created successfully');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
      fetchData();
    } catch {
      // Error toast already shown by axiosInstance interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) { message.warning('You do not have permission to delete processes'); return; }
    modal.confirm({
      title: 'Delete Process',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this process? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteProcess(selectedId);
          message.success('Process deleted successfully');
          handleCancel();
          fetchData();
        } catch {
          // Error toast already shown by axiosInstance interceptor
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(
      data.filter((item) =>
        item.processName?.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower) ||
        item.category?.toLowerCase().includes(lower)
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Processes"
      subtitle="Manufacturing"
      addLabel="Add Process"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      loading={loading}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search processes..."
      renderForm={() => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sticky header */}
          <div className="master-form-header" style={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'var(--card-bg, #fff)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #f0f0f0)',
          }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (isReadOnly ? 'View Process' : 'Edit Process') : 'New Process'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId ? 'Modify the process details below' : 'Define a new process — the category decides whether it carries a cost or allowances'}
              </Text>
            </div>
            <Space>
              {selectedId && canDelete && (
                <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>
                  Delete
                </Button>
              )}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
                  <Button
                    type="primary"
                    onClick={() => form.submit()}
                    icon={<SaveOutlined />}
                    loading={submitting}
                    disabled={selectedId && !unsavedChanges}
                  >
                    Save
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>

          {/* Form content */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                disabled={isReadOnly}
                onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
              >
                <Form.Item name="processName" label="Process Name" rules={[{ required: true, message: 'Please enter a process name' }]}>
                  <Input placeholder="e.g. Fabric Dyeing" maxLength={200} />
                </Form.Item>
                <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
                  <Select placeholder="Select category" options={CATEGORY_OPTIONS} allowClear />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input.TextArea rows={2} placeholder="Optional description" maxLength={500} />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.category !== cur.category}>
                  {() => {
                    const category = form.getFieldValue('category');
                    if (!category) return null;
                    if (isCostCategory(category)) return (
                      <Form.Item name="defaultCost" label="Default Cost">
                        <InputNumber min={0} precision={2} controls={false} prefix="₹" placeholder="e.g. 25.50" style={{ width: '100%' }} {...numericInputProps} />
                      </Form.Item>
                    );
                    return (
                      <>
                        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>Process Defaults</Divider>
                        <Alert
                          type="info"
                          showIcon
                          icon={<InfoCircleOutlined />}
                          message="Set default allowance values for this process. When selected in a BOM, these values will be auto-applied to calculate purchase quantities."
                          style={{ marginBottom: 16, fontSize: 12 }}
                        />
                        <Row gutter={16}>
                          <Col span={6}>
                            <Form.Item name="defaultShrinkageInches" label="Shrinkage">
                              <InputNumber min={0} max={100} precision={2} controls={false} placeholder="e.g. 2.0" addonAfter="in" style={{ width: '100%' }} onBlur={(e) => { if (!e.target.value) form.setFieldValue('defaultShrinkageInches', 0); }} {...numericInputProps} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="defaultProcessLossPercent" label="Process Loss">
                              <InputNumber min={0} max={100} precision={2} controls={false} placeholder="e.g. 5.0" addonAfter="%" style={{ width: '100%' }} onBlur={(e) => { if (!e.target.value) form.setFieldValue('defaultProcessLossPercent', 0); }} {...numericInputProps} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="defaultRejectionPercent" label="Rejection">
                              <InputNumber min={0} max={100} precision={2} controls={false} placeholder="e.g. 2.0" addonAfter="%" style={{ width: '100%' }} onBlur={(e) => { if (!e.target.value) form.setFieldValue('defaultRejectionPercent', 0); }} {...numericInputProps} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="defaultShipmentAllowancePercent" label="Shipment">
                              <InputNumber min={0} max={100} precision={2} controls={false} placeholder="e.g. 3.0" addonAfter="%" style={{ width: '100%' }} onBlur={(e) => { if (!e.target.value) form.setFieldValue('defaultShipmentAllowancePercent', 0); }} {...numericInputProps} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </>
                    );
                  }}
                </Form.Item>

                <Form.Item name="isActive" label="Active" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </Form>
          </div>
        </div>
      )}
    />
  );
};

export default ProcessMaster;
