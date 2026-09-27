import { useCallback, useState } from 'react';
import { App, Upload } from 'antd';
import {
  deleteAttachment, downloadAttachment, getAttachments, uploadAttachmentsBatch,
} from '../../../../services/costing/costingService';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from '../../../../utils/costingConstants';

const EMPTY = { TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] };

const group = (list) => {
  const grouped = { TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] };
  // The garment image is a cost-sheet file too; it has its own slot, so keep it out of here.
  (list || []).filter((a) => !['IMAGE', 'PHOTO'].includes(a.fileCategory)).forEach((a) => {
    const cat = grouped[a.fileCategory] ? a.fileCategory : 'OTHER';
    grouped[cat].push({ uid: a.fileId, name: a.originalFilename, status: 'done', size: a.fileSizeBytes, type: a.fileType, fileId: a.fileId });
  });
  return grouped;
};

const openBlob = (blob, name) => {
  const url = window.URL.createObjectURL(blob);
  if (name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); } else window.open(url, '_blank', 'noopener');
};

/**
 * Tech pack / measurement chart / other files. On a saved sheet a file uploads the moment it is
 * picked (as the garment image does) — a sheet with nothing else changed is not saved again, so
 * staging it would never send it. On a new sheet it waits for the first save.
 */
export default function useAttachments(sheetId) {
  const { message } = App.useApp();
  const [files, setFiles] = useState(EMPTY);

  const load = useCallback((id) => getAttachments(id).then((list) => setFiles(group(list))).catch(() => setFiles(EMPTY)), []);

  const uploadStaged = useCallback(async (id) => {
    const items = Object.entries(files).flatMap(([category, list]) => list.filter((f) => !f.fileId).map((file) => ({ file, category })));
    if (!items.length) return;
    try {
      await uploadAttachmentsBatch(id, items);
      await load(id);
    } catch {
      message.warning('Failed to upload some attachments');
    }
  }, [files, load, message]);

  const uploadProps = (category) => ({
    fileList: files[category],
    showUploadList: { showDownloadIcon: true, showPreviewIcon: true },
    onDownload: (file) => file.fileId && downloadAttachment(file.fileId).then((b) => openBlob(b, file.name)).catch(() => message.error('Failed to download file')),
    onPreview: (file) => (file.fileId ? downloadAttachment(file.fileId).then((b) => openBlob(b)) : Promise.resolve(openBlob(file.originFileObj || file))).catch(() => message.error('Failed to preview file')),
    onRemove: async (file) => {
      if (file.fileId) {
        try { await deleteAttachment(file.fileId); } catch { message.error('Failed to delete file'); return false; }
      }
      setFiles((prev) => ({ ...prev, [category]: prev[category].filter((f) => f.uid !== file.uid) }));
      return true;
    },
    beforeUpload: (file) => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) { message.error('File type not allowed. Use JPG, PNG, PDF, DOC, or XLS.'); return Upload.LIST_IGNORE; }
      if (file.size / 1024 / 1024 >= MAX_FILE_SIZE_MB) { message.error(`File must be smaller than ${MAX_FILE_SIZE_MB}MB`); return Upload.LIST_IGNORE; }
      if (files[category].some((f) => f.name === file.name && (f.size ?? 0) === file.size)) { message.warning('This file has already been added.'); return Upload.LIST_IGNORE; }
      if (sheetId) {
        const pending = { uid: file.uid, name: file.name, size: file.size, status: 'uploading' };
        setFiles((prev) => ({ ...prev, [category]: [...prev[category], pending] }));
        uploadAttachmentsBatch(sheetId, [{ file, category }])
          .then(() => load(sheetId))
          .then(() => message.success(`${file.name} attached`))
          .catch(() => {
            message.error(`${file.name} could not be uploaded. Try again.`);
            setFiles((prev) => ({ ...prev, [category]: prev[category].filter((f) => f.uid !== file.uid) }));
          });
        return false;
      }
      setFiles((prev) => ({ ...prev, [category]: [...prev[category], file] }));
      return false;
    },
  });

  const count = Object.values(files).reduce((n, list) => n + list.length, 0);
  return { files, count, load, uploadStaged, uploadProps };
}
