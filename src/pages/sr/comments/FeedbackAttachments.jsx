import { useCallback, useMemo } from 'react';
import { App, Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { downloadStoredFile } from '../../../services/core/fileService';

const { Text } = Typography;

// Exactly what file storage accepts — offering a type it would refuse means a
// file that looks attached until the save quietly rejects it
const EXTENSIONS = ['xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg'];
const MAX_BYTES = 5 * 1024 * 1024;
const extOf = (name) => String(name || '').split('.').pop().toLowerCase();

/**
 * The buyer's own files on a comment record — the sheet that was imported,
 * marked-up photos, anything else worth keeping.
 *
 * `stored` are real files already in file storage and come back on the DTO;
 * `pending` are Files picked but not yet sent, because an upload needs the
 * sample request's id and so waits for the save. Read-only records render the
 * stored list alone.
 */
const FeedbackAttachments = ({ stored = [], pending = [], setPending, readOnly = false }) => {
  const { message } = App.useApp();

  const handleDownload = useCallback(async (file) => {
    try {
      await downloadStoredFile(file);
    } catch {
      message.error(`Failed to download ${file.originalFilename || 'the attachment'}`);
    }
  }, [message]);

  const beforeUpload = useCallback((file) => {
    if (!EXTENSIONS.includes(extOf(file.name))) {
      message.error('Only Excel, PDF or image files are allowed');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_BYTES) {
      message.error(`${file.name} exceeds 5 MB`);
      return Upload.LIST_IGNORE;
    }
    // Staged, not sent: the upload needs the request's id, so it waits for save
    setPending((prev) => [...prev, file]);
    return false;
  }, [message, setPending]);

  const handleRemove = useCallback(
    (file) => setPending((prev) => prev.filter((f) => f.uid !== file.uid)),
    [setPending],
  );

  const fileList = useMemo(
    () => pending.map((f) => ({ uid: f.uid, name: f.name, status: 'done' })),
    [pending],
  );

  const list = stored.length > 0 && (
    <Space direction="vertical" size={2} style={{ display: 'flex', marginBottom: readOnly ? 0 : 8 }}>
      {stored.map((file) => (
        <Space key={file.fileId || file.id} size={4}>
          <PaperClipOutlined style={{ color: 'var(--text-secondary)' }} />
          <span>{file.originalFilename}</span>
          <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(file)}>
            Download
          </Button>
        </Space>
      ))}
    </Space>
  );

  if (readOnly) {
    if (!stored.length) return null;
    return (
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Attachments</Text>
        {list}
      </div>
    );
  }

  return (
    <>
      {list}
      <Upload multiple accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg" beforeUpload={beforeUpload} onRemove={handleRemove} fileList={fileList}>
        <Button icon={<UploadOutlined />}>Add attachment</Button>
      </Upload>
    </>
  );
};

export default FeedbackAttachments;
