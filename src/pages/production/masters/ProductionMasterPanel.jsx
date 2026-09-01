import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Button, Space, App, Typography } from 'antd';
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import MasterSplitView from '../../../components/MasterSplitView';
import PermissionGuard from '../../../components/PermissionGuard';
import { hasPermission } from '../../../utils/permissions';

const { Text } = Typography;

export const MODULE_ID = 'production-masters';

/**
 * The shell every production master shares: list, search, create, edit, delete.
 * Each master supplies only what makes it different — its columns, its form
 * fields and its four API calls — so the six of them stay a few dozen lines
 * each instead of six copies of the same three hundred.
 */
const ProductionMasterPanel = ({
  title,
  subtitle,
  noun,
  api,
  columns,
  renderFields,
  searchFields = ['name'],
  defaults,
  toFormValues,
  onDirtyChange,
  extraHeader,
}) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const skipDirty = useRef(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');

  const markDirty = useCallback((value) => {
    setDirty(value);
    onDirtyChange?.(value);
  }, [onDirtyChange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.list());
    } catch {
      message.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, title, message]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) => searchFields.some(
      (field) => String(row[field] ?? '').toLowerCase().includes(term),
    ));
  }, [data, search, searchFields]);

  /** Suppress the dirty flag while the form is being populated, not edited. */
  const settle = useCallback(() => {
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  }, [markDirty]);

  const handleAdd = useCallback(() => {
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue(defaults || {});
    settle();
  }, [form, defaults, settle]);

  const handleSelect = useCallback((record) => {
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue(toFormValues ? toFormValues(record) : record);
    settle();
  }, [form, toFormValues, settle]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    markDirty(false);
  }, [form, markDirty]);

  const handleSave = async (values) => {
    setSubmitting(true);
    try {
      if (selectedId) {
        const current = data.find((row) => row.id === selectedId);
        await api.update(selectedId, { ...values, id: selectedId, version: current?.version });
        message.success(`${noun} updated`);
      } else {
        await api.create(values);
        message.success(`${noun} created`);
      }
      markDirty(false);
      handleCancel();
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || `Failed to save the ${noun.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: `Delete ${noun}`,
      icon: <ExclamationCircleOutlined />,
      content: `Delete this ${noun.toLowerCase()}? Anything already recorded against it keeps its own copy, but it will stop being offered on new documents.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.remove(selectedId);
          message.success(`${noun} deleted`);
          handleCancel();
          load();
        } catch (e) {
          message.error(e?.response?.data?.message || `Failed to delete the ${noun.toLowerCase()}`);
        }
      },
    });
  };

  const readOnly = Boolean(selectedId) && !canUpdate;

  return (
    <MasterSplitView
      title={title}
      subtitle={subtitle}
      addLabel={`Add ${noun}`}
      data={visible}
      columns={columns}
      loading={loading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={setSearch}
      onCloseForm={handleCancel}
      searchPlaceholder={`Search ${title.toLowerCase()}...`}
      renderForm={() => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="master-form-header" style={{
            flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--card-bg, #fff)', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 24px', borderBottom: '1px solid var(--border-color, #f0f0f0)',
          }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {selectedId ? (readOnly ? `View ${noun}` : `Edit ${noun}`) : `New ${noun}`}
              </h2>
              {extraHeader && <Text type="secondary" style={{ fontSize: 12 }}>{extraHeader}</Text>}
            </div>
            <Space>
              {selectedId && canDelete && (
                <Button danger onClick={handleDelete} icon={<DeleteOutlined />}>Delete</Button>
              )}
              <Button onClick={handleCancel} icon={<CloseOutlined />}>
                {readOnly ? 'Close' : 'Cancel'}
              </Button>
              {!readOnly && (
                <PermissionGuard module={MODULE_ID} operation={selectedId ? 'update' : 'add'}>
                  <Button type="primary" icon={<SaveOutlined />} loading={submitting}
                    disabled={Boolean(selectedId) && !dirty} onClick={() => form.submit()}>
                    Save
                  </Button>
                </PermissionGuard>
              )}
            </Space>
          </div>

          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <Form form={form} layout="vertical" onFinish={handleSave} disabled={readOnly}
              onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}>
              {renderFields({ form, selectedId })}
            </Form>
          </div>
        </div>
      )}
    />
  );
};

export default ProductionMasterPanel;
