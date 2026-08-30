import { useState, useEffect } from 'react';
import { App, Modal, Table, Tag, Typography, Space, Empty, Spin, Input, Button, Popconfirm } from 'antd';
import { SaveOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { getTemplates, saveTemplate, deleteTemplate } from '../../services/costing/costingService';

const { Text } = Typography;

/**
 * CostingTemplateModal
 * Mode: 'load' — select a template to fill into the costing form
 * Mode: 'save' — save current detail rows as a new template
 */
const CostingTemplateModal = ({ open, onClose, onApply, mode = 'load', currentData }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveGarmentType, setSaveGarmentType] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && mode === 'load') {
      setLoading(true);
      getTemplates()
        .then(setTemplates)
        .catch(() => message.error('Failed to load templates'))
        .finally(() => setLoading(false));
    }
  }, [open, mode]);

  const handleLoad = (template) => {
    onApply(template.templateData);
    message.success(`Template "${template.templateName}" loaded`);
    onClose();
  };

  const handleDelete = async (id) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      message.success('Template deleted');
    } catch {
      message.error('Failed to delete template');
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) { message.warning('Please enter a template name'); return; }
    setSaving(true);
    try {
      await saveTemplate({
        templateName: saveName.trim(),
        description: saveDescription.trim() || null,
        garmentType: saveGarmentType.trim() || null,
        templateData: currentData,
      });
      message.success(`Template "${saveName}" saved`);
      onClose();
    } catch {
      message.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Template Name', dataIndex: 'templateName', render: (v) => <Text strong>{v}</Text> },
    { title: 'Garment Type', dataIndex: 'garmentType', width: 140, render: (v) => v ? <Tag>{v}</Tag> : '-' },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: '', width: 140, render: (_, record) => (
        <Space size="small">
          <Button size="small" type="primary" onClick={() => handleLoad(record)}>Load</Button>
          <Popconfirm title="Delete this template?" onConfirm={() => handleDelete(record.id)} okText="Delete" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (mode === 'save') {
    return (
      <Modal
        title={<Space><SaveOutlined /> Save as Template</Space>}
        open={open}
        onCancel={onClose}
        onOk={handleSave}
        okText="Save Template"
        confirmLoading={saving}
        centered
        width={480}
        destroyOnClose
        afterClose={() => { setSaveName(''); setSaveDescription(''); setSaveGarmentType(''); }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12 }}>Template Name *</Text>
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Standard T-Shirt Trims" maxLength={200} style={{ marginTop: 4 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12 }}>Garment Type</Text>
          <Input value={saveGarmentType} onChange={(e) => setSaveGarmentType(e.target.value)} placeholder="e.g. T-Shirt, Polo, Hoodie" maxLength={100} style={{ marginTop: 4 }} />
        </div>
        <div>
          <Text strong style={{ fontSize: 12 }}>Description</Text>
          <Input.TextArea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} placeholder="Optional description" maxLength={500} rows={2} style={{ marginTop: 4 }} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={<Space><FolderOpenOutlined /> Load Template</Space>}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={680}
      centered
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : templates.length === 0 ? (
        <Empty description="No templates saved yet. Create a cost sheet and use 'Save as Template' to create one." />
      ) : (
        <Table dataSource={templates} columns={columns} pagination={false} size="small" rowKey="id" scroll={{ y: 400 }} />
      )}
    </Modal>
  );
};

export default CostingTemplateModal;
