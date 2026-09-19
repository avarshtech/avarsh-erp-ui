import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, Switch, App, Tag, Select, Row, Col } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getAllBranches, createBranch, updateBranch, deleteBranch } from '../../services/master/branchService';
import { useBranch } from '../../context/BranchContext';
import { hasPermission } from '../../utils/permissions';
import { toastUnlessHandled } from '../../utils/apiError';
import { INDIAN_STATES } from '../../utils/hrConstants';
import PermissionGuard from '../../components/PermissionGuard';

const MODULE_ID = 'branches';

/**
 * Branch master — the sites the company operates from. Units hang under a branch,
 * and because GST registration is state-wise a branch usually carries its own
 * GSTIN, which is what goes on POs delivered there and invoices raised from there.
 * The head office is seeded from the company profile and is where everything
 * lands until a second branch exists.
 */
const BranchMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const { refresh: refreshBranches } = useBranch();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: list } = await getAllBranches();
      setData(list || []);
      setFilteredData(list || []);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'branchCode', width: 90, sorter: (a, b) => (a.branchCode || '').localeCompare(b.branchCode || '') },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      sorter: (a, b) => (a.branchName || '').localeCompare(b.branchName || ''),
      render: (v, r) => <>{v}{r.isHeadOffice && <Tag color="gold" style={{ marginLeft: 8 }}>Head Office</Tag>}</>,
    },
    { title: 'City', dataIndex: 'city', width: 120 },
    { title: 'GSTIN', dataIndex: 'gstin', width: 170, render: (v) => v || '—' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      align: 'center',
      width: 100,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="success">Active</Tag>),
    },
  ], []);

  const openForm = useCallback((record) => {
    skipDirty.current = true;
    setSelectedId(record?.id ?? null);
    setIsEditing(true);
    if (record) form.setFieldsValue({ ...record, isActive: record.isActive !== false });
    else { form.resetFields(); form.setFieldsValue({ isActive: true, isHeadOffice: false }); }
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [form, markDirty]);

  const handleAdd = useCallback(() => {
    if (!canAdd) { message.warning('You do not have permission to add branches'); return; }
    openForm(null);
  }, [canAdd, openForm, message]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  const handleSave = useCallback(async (values) => {
    const code = (values.branchCode || '').trim().toUpperCase();
    if (data.some((b) => (b.branchCode || '').toUpperCase() === code && b.id !== selectedId)) {
      message.error('A branch with this code already exists');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...values, branchCode: code, isActive: values.isActive !== false, isHeadOffice: !!values.isHeadOffice };
      if (selectedId) {
        await updateBranch(selectedId, { ...payload, version: data.find((b) => b.id === selectedId)?.version });
      } else {
        await createBranch(payload);
      }
      message.success(selectedId ? 'Branch updated' : 'Branch created');
      await Promise.all([loadData(), refreshBranches()]);
      handleCancel();
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save branch');
    } finally {
      setSubmitting(false);
    }
  }, [data, selectedId, loadData, refreshBranches, handleCancel, message]);

  const handleDelete = useCallback(() => {
    modal.confirm({
      title: 'Delete Branch',
      icon: <ExclamationCircleOutlined />,
      content: 'This permanently removes the branch. One that still has units under it cannot be deleted — switch it to Inactive instead. Continue?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteBranch(selectedId);
          message.success('Branch deleted');
          await Promise.all([loadData(), refreshBranches()]);
          handleCancel();
        } catch (e) {
          toastUnlessHandled(message, e, 'Failed to delete branch');
        }
      },
    });
  }, [modal, selectedId, loadData, refreshBranches, handleCancel, message]);

  const handleSearch = useCallback((value) => {
    const lower = value.trim().toLowerCase();
    setFilteredData(data.filter((b) =>
      (b.branchCode || '').toLowerCase().includes(lower)
      || (b.branchName || '').toLowerCase().includes(lower)
      || (b.city || '').toLowerCase().includes(lower)));
  }, [data]);

  const isReadOnly = !!selectedId && !canUpdate;
  const selected = data.find((b) => b.id === selectedId);

  return (
    <MasterSplitView
      title="Branches"
      subtitle="Organisation"
      addLabel="Add Branch"
      data={filteredData}
      columns={columns}
      loading={loading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={openForm}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search branches..."
      renderForm={() => (
        <div style={{ padding: 24 }}>
          <div className="master-form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{selectedId ? (isReadOnly ? 'View Branch' : 'Edit Branch') : 'New Branch'}</h2>
            <Space>
              {selectedId && canDelete && !selected?.isHeadOffice && <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
              {!isReadOnly && (
                <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
                  <Button type="primary" onClick={() => form.submit()} icon={<SaveOutlined />} loading={submitting} disabled={!!selectedId && !unsavedChanges}>
                    Save Changes
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSave} disabled={isReadOnly} onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="branchCode" label="Branch Code" rules={[{ required: true, message: 'Please enter a branch code' }]}>
                  <Input placeholder="e.g. TIR" maxLength={20} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="branchName" label="Branch Name" rules={[{ required: true, message: 'Please enter a branch name' }]}>
                  <Input placeholder="e.g. Tirupur" maxLength={200} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={2} placeholder="Street address" maxLength={500} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="city" label="City"><Input maxLength={100} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="state" label="State">
                  <Select placeholder="Select state" options={INDIAN_STATES} showSearch optionFilterProp="label" allowClear />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pincode" label="Pincode"><Input maxLength={10} /></Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="gstin"
                  label="GSTIN"
                  extra="Printed as bill-to on POs delivered here and as exporter on invoices raised from here"
                  rules={[{ pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, message: '15 characters, e.g. 33ABCDE1234F1Z5' }]}
                >
                  <Input maxLength={15} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="stateCode" label="GST State Code"><Input placeholder="33" maxLength={10} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="phone" label="Phone"><Input maxLength={20} /></Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}><Input maxLength={150} /></Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="pfCode" label="PF Code"><Input maxLength={50} /></Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="esiCode" label="ESI Code"><Input maxLength={50} /></Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="ptRegNo" label="PT Reg. No"><Input maxLength={50} /></Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="isHeadOffice" label="Head Office" valuePropName="checked" extra="the default wherever a document names no branch — only one branch can be the head office">
                  <Switch disabled={isReadOnly || !!selected?.isHeadOffice} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="isActive" label="Active" valuePropName="checked" extra="inactive branches stay on past documents but are no longer offered">
                  <Switch disabled={isReadOnly || !!selected?.isHeadOffice} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      )}
    />
  );
};

export default BranchMaster;
