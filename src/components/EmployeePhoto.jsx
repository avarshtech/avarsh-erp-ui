import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Image, Space, Spin, Tooltip, Upload } from 'antd';
import {
  DeleteOutlined, DownloadOutlined, EyeOutlined, LoadingOutlined,
  UploadOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  deleteFile, downloadFileAsBlob, downloadStoredFile, getFilesByEntity, uploadFile,
} from '../services/core/fileService';
import { toastUnlessHandled } from '../utils/apiError';

/**
 * The employee's photo, where a photo belongs: the top corner of their record.
 *
 * It is one of the files already attached to the employee - entity EMPLOYEE,
 * category PHOTO - so nothing new is stored and the existing access rules
 * apply: reading needs hr-employees:view and changing it needs a write right,
 * which is right for a picture of a person.
 *
 * The newest PHOTO wins. Replacing one uploads the new file and removes the old
 * only once the new is safely stored, so a failed upload cannot leave the
 * record with no photo at all.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

const EmployeePhoto = ({ employeeId, employeeName, canEdit = false, size = 96 }) => {
  const { message, modal } = App.useApp();
  const [photo, setPhoto] = useState(null);
  const [src, setSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  // Revoked on replace and on unmount: an object URL the browser holds for the
  // life of the document is a leak on a screen people page through.
  const objectUrl = useRef(null);

  const show = useCallback((blob) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = blob ? URL.createObjectURL(blob) : null;
    setSrc(objectUrl.current);
  }, []);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setBusy(true);
    try {
      const files = await getFilesByEntity('EMPLOYEE', employeeId);
      const photos = (Array.isArray(files) ? files : []).filter((f) => f.fileCategory === 'PHOTO');
      const latest = photos.at(-1) ?? null;
      setPhoto(latest);
      show(latest ? await downloadFileAsBlob(latest.fileId) : null);
    } catch {
      // A missing photo is not an error worth a toast - the placeholder says it.
      setPhoto(null);
      show(null);
    } finally {
      setBusy(false);
    }
  }, [employeeId, show]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const beforeUpload = async (file) => {
    if (!ACCEPT.split(',').includes(file.type)) {
      message.error('Pick a JPG, PNG or WebP image.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_BYTES) {
      message.error(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 3 MB.`);
      return Upload.LIST_IGNORE;
    }
    setBusy(true);
    const previous = photo;
    try {
      const saved = await uploadFile(file, {
        module: 'HR', entity: 'EMPLOYEE', entityId: employeeId,
        fileCategory: 'PHOTO', description: `Photo of ${employeeName ?? 'employee'}`,
      });
      setPhoto(saved);
      show(file);
      message.success('Photo updated');
      // Only now is the old one expendable.
      if (previous?.fileId) await deleteFile(previous.fileId).catch(() => {});
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not upload the photo');
    } finally {
      setBusy(false);
    }
    return Upload.LIST_IGNORE;
  };

  const remove = () => modal.confirm({
    title: 'Remove this photo?',
    content: 'The employee record keeps everything else. You can upload another at any time.',
    okText: 'Remove',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteFile(photo.fileId);
        setPhoto(null);
        show(null);
        message.success('Photo removed');
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not remove the photo');
      }
    },
  });

  const frame = {
    width: size, height: size, borderRadius: 8, overflow: 'hidden',
    border: '1px solid var(--ant-color-border, rgba(0,0,0,0.12))',
    background: 'var(--ant-color-fill-tertiary, rgba(0,0,0,0.04))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  };

  const face = src
    ? <Image src={src} alt={employeeName ? `Photo of ${employeeName}` : 'Employee photo'}
        width={size} height={size} style={{ objectFit: 'cover' }}
        preview={{ visible: preview, onVisibleChange: setPreview, src }} />
    : <UserOutlined style={{ fontSize: size / 2.5, opacity: 0.3 }} aria-hidden="true" />;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={frame}>
        {busy ? <Spin indicator={<LoadingOutlined spin />} /> : face}
      </div>
      {/* Each action is its own control rather than a menu: only the upload
          button may be wrapped in Upload, or every click would open the file
          dialog. Four small buttons also read as four things you can do. */}
      <Space direction="vertical" size={2}>
        {photo && (
          <Tooltip title="View full size">
            <Button type="text" size="small" icon={<EyeOutlined />} aria-label="View photo"
              onClick={() => setPreview(true)} />
          </Tooltip>
        )}
        {photo && (
          <Tooltip title="Download">
            <Button type="text" size="small" icon={<DownloadOutlined />} aria-label="Download photo"
              onClick={() => downloadStoredFile(photo)
                .catch((e) => toastUnlessHandled(message, e, 'Could not download the photo'))} />
          </Tooltip>
        )}
        {canEdit && (
          <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPT}>
            <Tooltip title={photo ? 'Replace photo (max 3 MB)' : 'Upload photo (max 3 MB)'}>
              <Button type="text" size="small" icon={<UploadOutlined />} loading={busy}
                aria-label={photo ? 'Replace photo' : 'Upload photo'} />
            </Tooltip>
          </Upload>
        )}
        {canEdit && photo && (
          <Tooltip title="Remove">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove photo"
              onClick={remove} />
          </Tooltip>
        )}
      </Space>
    </div>
  );
};

export default EmployeePhoto;
