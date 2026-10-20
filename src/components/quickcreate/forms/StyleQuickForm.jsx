import { useEffect, useState } from 'react';
import { App, Col, Form, Input, Row, Select } from 'antd';
import { saveStyle } from '../../../services/master/styleService';
import { uploadFile } from '../../../services/core/fileService';
import { SEASON_CODES, SEASON_YEARS } from '../../../utils/costingConstants';
import FileUpload from '../../FileUpload';
import QuickFormFooter from './QuickFormFooter';

/**
 * A style for the chosen buyer. prefill: { text (style no), buyerId, buyerName, garmentName,
 * seasonCode, seasonYear }. The optional image is uploaded straight after the style is saved.
 */
export default function StyleQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const created = await saveStyle({ ...values, buyerId: prefill.buyerId, isActive: true });
      if (image && created?.id) {
        await uploadFile(image, { module: 'STYLE', entity: 'STYLE', entityId: created.id, fileCategory: 'IMAGE' })
          .catch(() => message.warning('Style created, but the image upload failed. Re-upload it from Style Master.'));
      }
      message.success(`Style "${created.styleNo}" created`);
      onDone(created);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form name="quickStyle" layout="vertical" onFinish={handleFinish} initialValues={{
      styleNo: prefill.text, garmentName: prefill.garmentName,
      seasonCode: prefill.seasonCode, seasonYear: prefill.seasonYear,
    }}>
      <Form.Item label="Buyer">
        <Input value={prefill.buyerName} disabled />
      </Form.Item>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="styleNo" label="Style No" rules={[{ required: true, message: 'Style No is required' }]}>
            <Input autoFocus maxLength={50} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="garmentName" label="Garment Name" rules={[{ required: true, message: 'Garment name is required' }]}>
            <Input placeholder="e.g. Polo T-Shirt" maxLength={150} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="seasonCode" label="Season">
            <Select allowClear placeholder="Season" options={SEASON_CODES} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="seasonYear" label="Year">
            <Select allowClear placeholder="Year" options={SEASON_YEARS} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="description" label="Fabric Description">
        <Input.TextArea rows={2} maxLength={500} placeholder="Optional" />
      </Form.Item>
      <Form.Item label="Style Image">
        <FileUpload
          accept="image/png,image/jpeg,image/jpg" maxSizeMB={10} compact
          previewUrl={imageUrl} fileName={image?.name || null} fileType={image?.type || null} fileSize={image?.size || null}
          onSelect={(file) => { setImage(file); setImageUrl(URL.createObjectURL(file)); }}
          onRemove={() => { setImage(null); setImageUrl(null); }}
          placeholder="Click or drag a style image"
        />
      </Form.Item>
      <QuickFormFooter saving={saving} onCancel={onCancel} />
    </Form>
  );
}
