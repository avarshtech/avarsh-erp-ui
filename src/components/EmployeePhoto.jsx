import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Image, Spin, Tooltip, Upload } from 'antd';
import {
  CameraOutlined, DeleteOutlined, DownloadOutlined, LoadingOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  deleteFile, downloadFileAsBlob, downloadStoredFile, getFilesByEntity, uploadFile,
} from '../services/core/fileService';
import { toastUnlessHandled } from '../utils/apiError';

/**
 * The employee's photo, beside their name.
 *
 * It is one of the files already attached to the employee - entity EMPLOYEE,
 * category PHOTO - so nothing new is stored and the existing access rules
 * apply: reading needs hr-employees:view and changing it needs a write right,
 * which is right for a picture of a person.
 *
 * The actions live on the photo rather than next to it. A permanent column of
 * icons reads as four more buttons on a header that already has Edit and
 * Change Status; on hover they are plainly about the picture they sit on, and
 * the rest of the time the header is a name and a face. Clicking the photo
 * opens it full size, which is what clicking a photo should do.
 *
 * The newest PHOTO wins. Replacing one uploads the new file and removes the old
 * only once the new is safely stored, so a failed upload cannot leave the
 * record with no photo at all.
 *
 * On a new employee there is no id yet, so there is nothing to attach a file
 * to. The photo is held instead: picked, previewed and handed to the form
 * through onPendingChange, and the form uploads it once the employee has been
 * created and has an id. Nothing is sent until the employee is saved, so
 * abandoning the form leaves no orphaned file behind.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

const EmployeePhoto = ({ employeeId, employeeName, canEdit = false, size = 104, onPendingChange }) => {
  const { message, modal } = App.useApp();
  // No id means the employee does not exist yet: hold the file, upload later.
  const staging = !employeeId;
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
    // Nothing to upload against yet - show it and let the form send it on save.
    if (staging) {
      setPhoto({ staged: true, name: file.name });
      show(file);
      onPendingChange?.(file);
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

  const removeStaged = () => {
    setPhoto(null);
    show(null);
    onPendingChange?.(null);
  };

  const remove = () => (staging ? removeStaged() : modal.confirm({
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
  }));

  const box = { width: size, height: size };

  // No photo and no right to add one: a plain silhouette, with no affordance
  // suggesting otherwise.
  if (!src && !canEdit) {
    return (
      <div className="employee-photo employee-photo-empty" style={box}>
        {busy ? <Spin indicator={<LoadingOutlined spin />} />
          : <UserOutlined style={{ fontSize: size / 2.6 }} aria-hidden="true" />}
      </div>
    );
  }

  // No photo, but one may be added: the whole frame is the target, which is a
  // bigger and plainer one than an icon button beside it.
  if (!src) {
    return (
      <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPT}>
        <Tooltip title="JPG, PNG or WebP, up to 3 MB">
          <div className="employee-photo employee-photo-add" style={box} role="button" tabIndex={0}>
            {busy ? <Spin indicator={<LoadingOutlined spin />} /> : (
              <>
                <CameraOutlined style={{ fontSize: size / 4 }} />
                <span className="employee-photo-add-label">Add photo</span>
              </>
            )}
          </div>
        </Tooltip>
      </Upload>
    );
  }

  return (
    <div className="employee-photo employee-photo-filled" style={box}>
      <Image
        src={src}
        alt={employeeName ? `Photo of ${employeeName}` : 'Employee photo'}
        width={size}
        height={size}
        style={{ objectFit: 'cover' }}
        preview={{ visible: preview, onVisibleChange: setPreview, src }}
      />
      {busy && <div className="employee-photo-busy"><Spin indicator={<LoadingOutlined spin />} /></div>}

      {/* Shown on hover and on keyboard focus, so the actions are reachable
          without a pointer. A held photo has nothing stored to download yet. */}
      <div className="employee-photo-actions">
        {!photo?.staged && (
          <Tooltip title="Download">
            <button
              type="button"
              aria-label="Download photo"
              onClick={() => downloadStoredFile(photo)
                .catch((e) => toastUnlessHandled(message, e, 'Could not download the photo'))}
            >
              <DownloadOutlined />
            </button>
          </Tooltip>
        )}
        {canEdit && (
          <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPT}>
            <Tooltip title="Replace photo">
              <button type="button" aria-label="Replace photo"><CameraOutlined /></button>
            </Tooltip>
          </Upload>
        )}
        {canEdit && (
          <Tooltip title="Remove photo">
            <button type="button" aria-label="Remove photo" className="is-danger" onClick={remove}>
              <DeleteOutlined />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default EmployeePhoto;
