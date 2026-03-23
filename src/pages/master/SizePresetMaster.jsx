import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button, Input, Select, Switch, Form, Space, Tag, Modal,
  Typography, message, Tooltip, Alert,
} from 'antd';
import {
  SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import MasterSplitView from '../../components/MasterSplitView';
import { useStore } from '../../context/StoreContext';
import {
  getAllSizePresets, createSizePreset, updateSizePreset, deleteSizePreset,
} from '../../services/sizePresetService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const { Text } = Typography;

const MODULE_ID = 'size-presets';

const CATEGORY_OPTIONS = [
  'Tops',
  'Bottoms',
  'Outerwear / Jackets',
  'Denim',
  'Dresses & Skirts',
  'Formal / Dress Shirts',
  'Sportswear / Activewear',
  'Nightwear / Loungewear',
  'Swimwear',
  'Kids - Alpha',
  'Kids - Numeric',
  'Baby',
];

// Industry-standard default sizes per [category][region]
// Used to auto-populate the sizes field when both are selected
const SIZE_DEFAULTS = {
  'Tops': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'UK / GB':            ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'EU':                 ['34', '36', '38', '40', '42', '44', '46'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'Japan':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Korea':              ['44', '55', '66', '77', '88'],
    'Australia':          ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  'Bottoms': {
    'US / North America': ['28', '30', '32', '34', '36', '38', '40'],
    'UK / GB':            ['28', '30', '32', '34', '36', '38', '40'],
    'EU':                 ['38', '40', '42', '44', '46', '48', '50'],
    'Asia / China':       ['26', '27', '28', '29', '30', '31', '32', '33', '34'],
    'Japan':              ['26', '27', '28', '29', '30', '31', '32'],
    'Korea':              ['26', '27', '28', '29', '30', '31', '32'],
    'Australia':          ['28', '30', '32', '34', '36', '38', '40'],
    'India':              ['28', '30', '32', '34', '36', '38', '40'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'Outerwear / Jackets': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'UK / GB':            ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'EU':                 ['34', '36', '38', '40', '42', '44', '46'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'Japan':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Korea':              ['44', '55', '66', '77', '88'],
    'Australia':          ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  'Denim': {
    'US / North America': ['28', '30', '32', '34', '36', '38', '40'],
    'UK / GB':            ['28', '30', '32', '34', '36', '38', '40'],
    'EU':                 ['38', '40', '42', '44', '46', '48'],
    'Asia / China':       ['26', '27', '28', '29', '30', '31', '32', '33', '34'],
    'Japan':              ['26', '27', '28', '29', '30', '31', '32'],
    'Korea':              ['26', '27', '28', '29', '30', '31', '32'],
    'Australia':          ['28', '30', '32', '34', '36', '38', '40'],
    'India':              ['28', '30', '32', '34', '36', '38', '40'],
    'International':      ['28', '30', '32', '34', '36', '38', '40'],
  },
  'Dresses & Skirts': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'UK / GB':            ['6', '8', '10', '12', '14', '16', '18', '20'],
    'EU':                 ['34', '36', '38', '40', '42', '44', '46'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Japan':              ['5', '7', '9', '11', '13', '15'],
    'Korea':              ['44', '55', '66', '77'],
    'Australia':          ['6', '8', '10', '12', '14', '16', '18', '20'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'Formal / Dress Shirts': {
    'US / North America': ['14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
    'UK / GB':            ['14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
    'EU':                 ['35/36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
    'Asia / China':       ['37', '38', '39', '40', '41', '42', '43', '44'],
    'Japan':              ['36', '37', '38', '39', '40', '41', '42', '43'],
    'Korea':              ['95', '100', '105', '110', '115'],
    'Australia':          ['14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
    'India':              ['37', '38', '39', '40', '41', '42', '43', '44'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'Sportswear / Activewear': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'UK / GB':            ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'EU':                 ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'Japan':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Korea':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Australia':          ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  'Nightwear / Loungewear': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'UK / GB':            ['6', '8', '10', '12', '14', '16', '18', '20'],
    'EU':                 ['34', '36', '38', '40', '42', '44', '46'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'Japan':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Korea':              ['44', '55', '66', '77', '88'],
    'Australia':          ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  'Swimwear': {
    'US / North America': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'UK / GB':            ['6', '8', '10', '12', '14', '16', '18'],
    'EU':                 ['34', '36', '38', '40', '42', '44'],
    'Asia / China':       ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'Japan':              ['5', '7', '9', '11', '13'],
    'Korea':              ['44', '55', '66', '77'],
    'Australia':          ['6', '8', '10', '12', '14', '16'],
    'India':              ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'International':      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'Kids - Alpha': {
    'US / North America': ['2T', '3T', '4T', '5T', '6/7', '8/9', '10/11', '12/13', '14/15'],
    'UK / GB':            ['1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y', '9-10Y', '11-12Y'],
    'EU':                 ['1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y', '9-10Y', '11-12Y'],
    'Asia / China':       ['90', '100', '110', '120', '130', '140', '150', '160'],
    'Japan':              ['90', '95', '100', '105', '110', '115', '120', '125', '130'],
    'Korea':              ['90', '100', '110', '120', '130', '140'],
    'Australia':          ['1', '2', '3', '4', '5', '6', '7', '8', '10', '12', '14'],
    'India':              ['2Y', '3Y', '4Y', '5Y', '6Y', '7Y', '8Y', '9Y', '10Y', '11Y', '12Y'],
    'International':      ['2T', '3T', '4T', '5T', '6/7', '8/9', '10/11', '12/13', '14/15'],
  },
  'Kids - Numeric': {
    'US / North America': ['2', '3', '4', '5', '6', '7', '8', '10', '12', '14', '16'],
    'UK / GB':            ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    'EU':                 ['92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '158', '164'],
    'Asia / China':       ['90', '100', '110', '120', '130', '140', '150', '160'],
    'Japan':              ['90', '95', '100', '105', '110', '115', '120', '125', '130'],
    'Korea':              ['90', '100', '110', '120', '130', '140', '150'],
    'Australia':          ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16'],
    'India':              ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    'International':      ['2/3Y', '3/4Y', '4/5Y', '5/6Y', '6/7Y', '7/8Y', '8/9Y', '9/10Y', '10/11Y', '11/12Y', '13/14Y'],
  },
  'Baby': {
    'US / North America': ['NB', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
    'UK / GB':            ['Tiny Baby', 'NB', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
    'EU':                 ['50', '56', '62', '68', '74', '80', '86'],
    'Asia / China':       ['59', '66', '73', '80', '90'],
    'Japan':              ['50', '60', '70', '80', '90', '95'],
    'Korea':              ['60', '70', '80', '90'],
    'Australia':          ['0000', '000', '00', '0', '1'],
    'India':              ['NB', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
    'International':      ['NB', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
  },
};

const REGION_OPTIONS = [
  { value: 'US / North America', label: 'US / North America' },
  { value: 'UK / GB',            label: 'UK / GB' },
  { value: 'EU',                 label: 'EU (European)' },
  { value: 'Asia / China',       label: 'Asia / China' },
  { value: 'Japan',              label: 'Japan' },
  { value: 'Korea',              label: 'Korea' },
  { value: 'Australia',          label: 'Australia' },
  { value: 'India',              label: 'India' },
  { value: 'International',      label: 'International / Alpha' },
];

const CATEGORY_COLORS = {
  'Tops':                    'blue',
  'Bottoms':                 'geekblue',
  'Outerwear / Jackets':     'volcano',
  'Denim':                   'cyan',
  'Dresses & Skirts':        'pink',
  'Formal / Dress Shirts':   'purple',
  'Sportswear / Activewear': 'lime',
  'Nightwear / Loungewear':  'magenta',
  'Swimwear':                'cyan',
  'Kids - Alpha':            'orange',
  'Kids - Numeric':          'gold',
  'Baby':                    'red',
};

const REGION_COLORS = {
  'US / North America': 'blue',
  'UK / GB':            'geekblue',
  'EU':                 'cyan',
  'Asia / China':       'orange',
  'Japan':              'volcano',
  'Korea':              'pink',
  'Australia':          'green',
  'India':              'gold',
  'International':      'default',
};

const SizePresetMaster = ({ onDirtyChange }) => {
  const { sizePresets, setData, addItem, updateItem, removeItem } = useStore();

  const [filteredData, setFilteredData]     = useState([]);
  const [selectedId, setSelectedId]         = useState(null);
  const [isEditing, setIsEditing]           = useState(false);
  const [localLoading, setLocalLoading]     = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [form]    = Form.useForm();
  const skipDirty  = useRef(false);
  const fetchingRef = useRef(false);

  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);

  const canAdd    = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView   = hasPermission(MODULE_ID, 'view');

  // ── Fetch (local loading — never touches store loading to avoid unmount loop) ──
  const fetchData = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;
    setLocalLoading(true);
    try {
      const response = await getAllSizePresets();
      const data = Array.isArray(response?.data) ? response.data : [];
      setData('sizePresets', data);
      setFilteredData(data);
    } catch {
      message.error('Failed to load size presets');
    } finally {
      setLocalLoading(false);
      fetchingRef.current = false;
    }
  }, [setData]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (sizePresets?.length > 0) setFilteredData(sizePresets);
  }, [sizePresets]);

  // ── Table columns ────────────────────────────────────────────────
  const columns = [
    {
      title: 'Preset Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (val) => val
        ? <Tag color={CATEGORY_COLORS[val] || 'default'}>{val}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      width: 160,
      render: (val) => val
        ? <Tag color={REGION_COLORS[val] || 'default'}>{val}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      key: 'sizes',
      render: (sizes) => {
        const list    = sizes || [];
        const visible = list.slice(0, 6);
        const rest    = list.length - visible.length;
        return (
          <Space size={3} wrap>
            {visible.map(s => (
              <Tag key={s} style={{ margin: 0, fontSize: 11, padding: '0 5px', lineHeight: '20px' }}>
                {s}
              </Tag>
            ))}
            {rest > 0 && (
              <Tooltip title={list.slice(6).join('  ·  ')}>
                <Tag style={{ margin: 0, fontSize: 11, cursor: 'default', border: '1px dashed' }}>
                  +{rest}
                </Tag>
              </Tooltip>
            )}
            {list.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>No sizes</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  // ── Handlers ─────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!canAdd) { message.warning('No permission to add size presets'); return; }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    form.resetFields();
    form.setFieldsValue({ active: true, sizes: [] });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('No permission to view size presets');
      return;
    }
    skipDirty.current = true;
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      name:     record.name,
      category: record.category,
      region:   record.region,
      sizes:    record.sizes || [],
      active:   record.active !== false,
    });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('No permission to update size presets'); return;
    }
    if (!selectedId && !canAdd) {
      message.warning('No permission to add size presets'); return;
    }

    const name = (values.name || '').trim();
    const duplicate = (sizePresets || []).some(
      p => (p.name || '').trim().toLowerCase() === name.toLowerCase() && p.id !== selectedId
    );
    if (duplicate) { message.error('A preset with this name already exists'); return; }

    if (!values.sizes || values.sizes.length === 0) {
      message.error('Please add at least one size'); return;
    }

    setSubmitting(true);
    try {
      const payload = { ...values, name };
      if (selectedId) {
        const selectedRecord = (sizePresets || []).find(p => p.id === selectedId);
        const res = await updateSizePreset(selectedId, { ...payload, version: selectedRecord?.version });
        const updated = res?.data || { id: selectedId, ...payload };
        updateItem('sizePresets', selectedId, updated);
        message.success('Size preset updated');
      } else {
        const res = await createSizePreset(payload);
        const newItem = res?.data || { id: Date.now(), ...payload };
        addItem('sizePresets', newItem);
        setSelectedId(newItem.id);
        message.success('Size preset created');
      }
      markDirty(false);
      setIsEditing(false);
      setSelectedId(null);
      await fetchData(true);
    } catch {
      // Error toast already shown by axiosInstance interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) { message.warning('No permission to delete size presets'); return; }
    Modal.confirm({
      title:   'Delete Size Preset',
      icon:    <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this preset? This action cannot be undone.',
      okText:  'Delete',
      okType:  'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSizePreset(selectedId);
          removeItem('sizePresets', selectedId);
          message.success('Size preset deleted');
          handleCancel();
          await fetchData(true);
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
      (sizePresets || []).filter(p =>
        p.name?.toLowerCase().includes(lower) ||
        p.category?.toLowerCase().includes(lower) ||
        p.region?.toLowerCase().includes(lower) ||
        p.sizes?.some(s => s.toLowerCase().includes(lower))
      )
    );
  };

  const isReadOnly = selectedId && !canUpdate;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <MasterSplitView
      title="Size Presets"
      subtitle="Order Entry, Costing"
      addLabel="Add Preset"
      data={filteredData}
      columns={columns}
      loading={localLoading}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search presets, sizes, region…"
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
                {selectedId
                  ? (isReadOnly ? 'View Size Preset' : 'Edit Size Preset')
                  : 'New Size Preset'}
              </h2>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedId
                  ? 'Modify the preset details and sizes below'
                  : 'Define a reusable size run for orders and costing'}
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

          {/* Scrollable form body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                disabled={isReadOnly}
                onValuesChange={(changedValues, allValues) => {
                  if (!skipDirty.current) markDirty(true);
                  if (changedValues.category !== undefined || changedValues.region !== undefined) {
                    const { category, region } = allValues;
                    if (category && region) {
                      const defaults = SIZE_DEFAULTS[category]?.[region];
                      if (defaults) {
                        skipDirty.current = true;
                        form.setFieldsValue({ sizes: defaults });
                        setTimeout(() => { skipDirty.current = false; }, 300);
                        message.info('Sizes updated to industry standard for selected category & region.');
                      }
                    }
                  }
                }}
              >
                <Form.Item
                  name="name"
                  label="Preset Name"
                  rules={[
                    { required: true, message: 'Please enter a preset name' },
                    { min: 2,         message: 'At least 2 characters' },
                    { max: 100,       message: 'Cannot exceed 100 characters' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const trimmed = value.trim().toLowerCase();
                        const dup = (sizePresets || []).some(
                          p => (p.name || '').trim().toLowerCase() === trimmed && p.id !== selectedId
                        );
                        return dup
                          ? Promise.reject(new Error('A preset with this name already exists'))
                          : Promise.resolve();
                      },
                    },
                  ]}
                  extra="This name will appear in the size preset dropdown on orders and costing"
                >
                  <Input
                    placeholder="e.g. Alpha (XS–3XL), UK Ladies, EU Kids Numeric"
                    size="large"
                  />
                </Form.Item>

                <Form.Item name="category" label="Garment Category">
                  <Select
                    placeholder="Select garment category"
                    allowClear
                    size="large"
                    options={CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))}
                  />
                </Form.Item>

                <Form.Item name="region" label="Regional Standard">
                  <Select
                    placeholder="Select regional sizing standard"
                    allowClear
                    size="large"
                    options={REGION_OPTIONS}
                  />
                </Form.Item>

                <Form.Item
                  name="sizes"
                  label={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      Sizes
                      {!isReadOnly && (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', fontSize: 12 }}
                          onClick={() => {
                            form.setFieldsValue({ sizes: [] });
                            markDirty(true);
                          }}
                        >
                          Clear All
                        </Button>
                      )}
                    </span>
                  }
                  rules={[{ required: true, message: 'Add at least one size' }]}
                  extra="Type each size label and press Enter. The order you enter them is the order they appear on the order sheet."
                >
                  <Select
                    mode="tags"
                    size="large"
                    placeholder="Type a size and press Enter — e.g. XS, S, M, L, XL"
                    tokenSeparators={[',']}
                    notFoundContent={null}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item name="active" label="Status" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </Form>
          </div>
        </div>
      )}
    />
  );
};

export default SizePresetMaster;
