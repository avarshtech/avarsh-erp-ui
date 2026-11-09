import { useCallback, useEffect, useState } from 'react';
import {
  App, Form, Input, Modal, Select,
} from 'antd';
import { createTemplateDraft } from '../../../services/tna/tnaService';
import { getBuyers } from '../../../services/master/buyerService';
import { useStore } from '../../../context/StoreContext';

/** Starts a draft template for a buyer (or the default), copied from an existing template. */
const NewTemplateModal = ({ open, templates, onClose, onCreated }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { buyers, setData, isCacheValid, setLoading } = useStore();

  const loadBuyers = useCallback(async () => {
    setLoading('buyers', true);
    try {
      const data = await getBuyers();
      setData('buyers', Array.isArray(data) ? data : data?.content || []);
    } catch {
      // The interceptor has toasted; the list we had stays
    } finally {
      setLoading('buyers', false);
    }
  }, [setData, setLoading]);

  useEffect(() => {
    if (open && (!isCacheValid('buyers') || !buyers.length)) loadBuyers();
    // Once per opening: the store's cache is the source after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copyFrom = (templates.find((t) => t.status === 'ACTIVE' && !t.buyerId) || templates[0])?.id;

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const created = await createTemplateDraft({ ...values, garmentType: values.garmentType?.trim() || null });
      message.success(`${created.header.name} v${created.header.versionNo} created as a draft — adjust it, then activate`);
      onCreated(created);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to create the template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="New T&A template" okText="Create draft" onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={{ copyFromId: copyFrom, name: '', garmentType: '' }}>
        <Form.Item name="buyerId" label="Buyer" tooltip="Leave empty to draft a new version of the default template">
          <Select allowClear showSearch optionFilterProp="label" placeholder="All buyers (default template)"
            options={buyers.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Form.Item name="garmentType" label="Garment type (optional)" tooltip="Narrows the template to orders of this garment type, matched as the order records it">
          <Input maxLength={100} placeholder="e.g. Knit Top" />
        </Form.Item>
        <Form.Item name="name" label="Template name" rules={[{ required: true, message: 'Name the template' }]}>
          <Input maxLength={150} placeholder="e.g. H&M — knits" />
        </Form.Item>
        <Form.Item name="copyFromId" label="Copy milestones and durations from">
          <Select allowClear placeholder="Catalogue defaults"
            options={templates.map((t) => ({ value: t.id, label: `${t.buyerName || 'All buyers'} — ${t.name} v${t.versionNo} (${t.status.toLowerCase()})` }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default NewTemplateModal;
