import { useState, useEffect, useCallback, useRef } from 'react';
import MasterSplitView from '../../components/MasterSplitView';
import { Form, Input, Button, Space, App, Tag, Select, Switch, Row, Col, Typography } from 'antd';
const { Text } = Typography;
import { SaveOutlined, CloseOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useStore } from '../../context/StoreContext';
import { saveStyle, deleteStyle } from '../../services/master/styleService';
import { uploadFile, deleteFile, getFilesByEntity, downloadFileAsBlob } from '../../services/core/fileService';
import FileUpload from '../../components/FileUpload';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { SEASON_CODES, SEASON_YEARS } from '../../utils/costingConstants';

const MODULE_ID = 'style-master';

const StyleMaster = ({ onDirtyChange }) => {
  const { message, modal } = App.useApp();
  const { styles, buyers, addItem, updateItem, removeItem } = useStore();
  const [filteredData, setFilteredData] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const markDirty = useCallback((dirty) => { setUnsavedChanges(dirty); onDirtyChange?.(dirty); }, [onDirtyChange]);
  const [form] = Form.useForm();
  const skipDirty = useRef(false);

  // Style image state
  const [imageFile, setImageFile] = useState(null);           // locally staged File (new styles only)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // blob URL for display
  const [existingImage, setExistingImage] = useState(null);   // server-side FileStorageDTO
  const [imageUploading, setImageUploading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  useEffect(() => {
    setFilteredData(styles);
  }, [styles]);

  // Build a buyer lookup map for display
  const buyerMap = {};
  buyers.forEach(b => { buyerMap[b.id] = b.name; });

  const columns = [
    {
      title: 'Style No',
      dataIndex: 'styleNo',
      width: 120,
      sorter: (a, b) => (a.styleNo || '').localeCompare(b.styleNo || ''),
      render: (text) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: 'Garment',
      dataIndex: 'garmentName',
      sorter: (a, b) => (a.garmentName || '').localeCompare(b.garmentName || ''),
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerId',
      render: (buyerId) => buyerMap[buyerId] || buyerId || '-',
    },
    {
      title: 'Season',
      dataIndex: 'seasonCode',
      width: 130,
      render: (val, record) => {
        if (!val) return '-';
        const codeLabel = SEASON_CODES.find((s) => s.value === val)?.label || val;
        return <Tag>{codeLabel} {record.seasonYear || ''}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 80,
      render: (val) => val === false
        ? <Tag color="default">Inactive</Tag>
        : <Tag color="green">Active</Tag>,
    },
  ];

  // ==================== IMAGE HELPERS ====================

  const clearImageState = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    setExistingImage(null);
    setImageUploading(false);
    setImageLoading(false);
  };

  /** Load existing style image by style ID */
  const loadStyleImage = async (styleId) => {
    if (!styleId) return;
    setImageLoading(true);
    try {
      const files = await getFilesByEntity('STYLE', styleId);
      const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
      if (!img) { setImageLoading(false); return; }
      const blob = await downloadFileAsBlob(img.fileId);
      const url = URL.createObjectURL(blob);
      setExistingImage(img);
      setImagePreviewUrl(url);
    } catch {
      // Image not found or failed to load — non-critical
    } finally {
      setImageLoading(false);
    }
  };

  /** Handle image selection */
  const handleImageSelect = async (file) => {
    // Revoke old preview if it was from a locally selected file
    if (imagePreviewUrl && imageFile) URL.revokeObjectURL(imagePreviewUrl);
    const previewUrl = URL.createObjectURL(file);

    if (selectedId) {
      // Existing style — upload immediately
      setImagePreviewUrl(previewUrl);
      setImageFile(null);
      setImageUploading(true);
      try {
        // Delete old image if replacing
        if (existingImage?.fileId) {
          await deleteFile(existingImage.fileId).catch((err) =>
            console.error('Failed to delete old style image:', err),
          );
        }
        const result = await uploadFile(file, {
          module: 'STYLE',
          entity: 'STYLE',
          entityId: selectedId,
          fileCategory: 'IMAGE',
        });
        const uploaded = result?.data || result;
        setExistingImage(uploaded);
        setImageUploading(false);
        message.success('Style image uploaded');
      } catch {
        message.error('Image upload failed. Please try again.');
        URL.revokeObjectURL(previewUrl);
        setImagePreviewUrl(existingImage ? imagePreviewUrl : null);
        setImageUploading(false);
      }
    } else {
      // New style — stage locally, upload after save
      setImageFile(file);
      setImagePreviewUrl(previewUrl);
      markDirty(true);
      message.info('Image staged. It will be uploaded when the style is saved.');
    }
  };

  /** Handle image removal */
  const handleImageRemove = async () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

    if (existingImage?.fileId && selectedId) {
      // Existing style with server image — delete immediately
      const prevImage = existingImage;
      setImageFile(null);
      setImagePreviewUrl(null);
      setExistingImage(null);
      setImageUploading(true);
      try {
        await deleteFile(prevImage.fileId);
        setImageUploading(false);
        message.success('Image removed');
      } catch {
        message.error('Failed to remove image. Please try again.');
        setExistingImage(prevImage);
        setImageUploading(false);
      }
    } else {
      // New style or locally staged file — just clear
      setImageFile(null);
      setImagePreviewUrl(null);
      markDirty(true);
    }
  };

  /** Upload staged image after creating a new style */
  const processStyleImage = async (savedStyle) => {
    if (!imageFile || !savedStyle?.id) return;
    try {
      await uploadFile(imageFile, {
        module: 'STYLE',
        entity: 'STYLE',
        entityId: savedStyle.id,
        fileCategory: 'IMAGE',
      });
    } catch {
      message.warning('Style saved, but image upload failed. You can re-upload by editing the style.');
    }
  };

  // ==================== CRUD HANDLERS ====================

  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add styles');
      return;
    }
    skipDirty.current = true;
    setSelectedId(null);
    setIsEditing(true);
    clearImageState();
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    markDirty(false);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSelect = (record) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view style details');
      return;
    }
    skipDirty.current = true;
    clearImageState();
    setSelectedId(record.id);
    setIsEditing(true);
    form.setFieldsValue({
      ...record,
      isActive: record.isActive !== false,
    });
    markDirty(false);
    loadStyleImage(record.id);
    setTimeout(() => { skipDirty.current = false; }, 300);
  };

  const handleSave = async (values) => {
    if (selectedId && !canUpdate) {
      message.warning('You do not have permission to update styles');
      return;
    }
    if (!selectedId && !canAdd) {
      message.warning('You do not have permission to add styles');
      return;
    }

    // Duplicate styleNo validation
    const styleNo = (values.styleNo || '').trim();
    const exists = styles.some(
      s => (s.styleNo || '').trim().toLowerCase() === styleNo.toLowerCase() && s.id !== selectedId
    );
    if (exists) {
      message.error('A style with this Style No already exists');
      return;
    }

    setSubmitting(true);
    try {
      const selectedRecord = selectedId ? styles.find(s => s.id === selectedId) : null;
      const payload = {
        ...values,
        ...(selectedId ? { id: selectedId, version: selectedRecord?.version } : {}),
      };
      const saved = await saveStyle(payload);
      // Upload staged image for new styles
      if (!selectedId) {
        await processStyleImage(saved);
      }
      if (selectedId) {
        updateItem('styles', selectedId, saved);
        message.success('Style updated successfully');
      } else {
        addItem('styles', saved);
        setSelectedId(saved.id);
        message.success('Style created successfully');
      }
      markDirty(false);
      clearImageState();
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      // Error toast already shown by axiosInstance interceptor
      console.error('Failed to save style:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete styles');
      return;
    }

    modal.confirm({
      title: 'Delete Style',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this style? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteStyle(selectedId);
          removeItem('styles', selectedId);
          message.success('Style deleted successfully');
          handleCancel();
        } catch (error) {
          // Error toast already shown by axiosInstance interceptor
          console.error('Failed to delete style:', error);
        }
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedId(null);
    form.resetFields();
    clearImageState();
    markDirty(false);
  };

  const handleSearch = (value) => {
    const lower = value.toLowerCase();
    setFilteredData(styles.filter(item =>
      item.styleNo?.toLowerCase().includes(lower) ||
      item.garmentName?.toLowerCase().includes(lower) ||
      buyerMap[item.buyerId]?.toLowerCase().includes(lower)
    ));
  };

  const isReadOnly = selectedId && !canUpdate;

  return (
    <MasterSplitView
      title="Styles"
      subtitle="Order Entry, Costing"
      addLabel="Add Style"
      data={filteredData}
      columns={columns}
      selectedId={selectedId}
      isEditing={isEditing}
      onAdd={canAdd ? handleAdd : undefined}
      onSelectRow={handleSelect}
      onSearch={handleSearch}
      onCloseForm={handleCancel}
      searchPlaceholder="Search by style no, garment or buyer..."
      renderForm={() => (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <div className="master-form-header" style={{
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
                  {selectedId ? (isReadOnly ? 'View Style' : 'Edit Style') : 'New Style'}
                </h2>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedId ? 'Modify the style details below' : 'Define a new garment style reference by buyer and season'}
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
                      Save Changes
                    </Button>
                  </PermissionGuard>
                )}
              </Space>
            </div>
            <div style={{ padding: 24 }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              disabled={isReadOnly}
              onValuesChange={() => { if (!skipDirty.current) markDirty(true); }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="styleNo"
                    label="Style No"
                    rules={[{ required: true, message: 'Please enter Style No' }]}
                  >
                    <Input placeholder="e.g. STY-001" maxLength={50} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="garmentName"
                    label="Garment Name"
                    rules={[{ required: true, message: 'Please enter Garment Name' }]}
                  >
                    <Input placeholder="e.g. Polo T-Shirt" maxLength={150} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="buyerId"
                    label="Buyer"
                    rules={[{ required: true, message: 'Please select a Buyer' }]}
                  >
                    <Select
                      placeholder="Select Buyer"
                      showSearch
                      optionFilterProp="label"
                      options={buyers.map(b => ({ value: b.id, label: b.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="seasonCode" label="Season">
                    <Select
                      placeholder="Season"
                      allowClear
                      options={SEASON_CODES}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="seasonYear" label="Year">
                    <Select
                      placeholder="Year"
                      allowClear
                      options={SEASON_YEARS}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Fabric Description">
                <Input.TextArea rows={3} placeholder="Fabric description (optional)" maxLength={500} />
              </Form.Item>

              {/* Style Image */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--bg-secondary, #f8fafc)',
                  marginBottom: 24,
                }}
              >
                <Text
                  type="secondary"
                  style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10, display: 'block' }}
                >
                  Style Image
                </Text>
                <FileUpload
                  accept="image/png,image/jpeg,image/jpg"
                  maxSizeMB={10}
                  previewUrl={imagePreviewUrl}
                  fileName={existingImage?.originalFilename || imageFile?.name || null}
                  fileType={existingImage?.fileType || imageFile?.type || null}
                  fileSize={existingImage?.fileSizeBytes || imageFile?.size || null}
                  onSelect={handleImageSelect}
                  onRemove={handleImageRemove}
                  disabled={isReadOnly || imageUploading}
                  loading={imageUploading || imageLoading}
                  compact
                  placeholder="Click or drag to upload style image"
                  hint="PNG, JPG up to 10 MB"
                />
                {!selectedId && imageFile && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                    Will upload on save
                  </Text>
                )}
              </div>

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

export default StyleMaster;
