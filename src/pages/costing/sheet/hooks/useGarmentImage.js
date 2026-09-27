import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { deleteFile, downloadFileAsBlob, getFilesByEntity, uploadFile } from '../../../../services/core/fileService';

// module must be a storage Module enum value: COSTING. The old sheet sent COST_SHEET, which
// the server rejects, so the garment image never uploaded.
const TARGET = { module: 'COSTING', entity: 'COST_SHEET', fileCategory: 'IMAGE' };

/** The garment image stored against the cost sheet: uploaded at once on a saved sheet, staged on a new one. */
export default function useGarmentImage() {
  const { message } = App.useApp();
  const [image, setImage] = useState({ url: null, existing: null, staged: null, busy: false });

  useEffect(() => () => { if (image.url) URL.revokeObjectURL(image.url); }, [image.url]);

  const load = useCallback(async (sheetId) => {
    try {
      const files = await getFilesByEntity('COST_SHEET', sheetId);
      const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
      if (img) setImage({ url: URL.createObjectURL(await downloadFileAsBlob(img.fileId)), existing: img, staged: null, busy: false });
    } catch {
      // No image, or it failed to load — not worth interrupting the user for.
    }
  }, []);

  const upload = useCallback(async (file, sheetId, replaced) => {
    if (replaced?.fileId) await deleteFile(replaced.fileId).catch(() => {});
    const res = await uploadFile(file, { ...TARGET, entityId: sheetId });
    return res?.data || res;
  }, []);

  const select = useCallback(async (file, sheetId) => {
    const url = URL.createObjectURL(file);
    if (!sheetId) { setImage((s) => ({ ...s, url, staged: file })); return; }
    setImage((s) => ({ ...s, url, busy: true }));
    try {
      const saved = await upload(file, sheetId, image.existing);
      setImage((s) => ({ ...s, existing: saved, staged: null, busy: false }));
      message.success('Garment image uploaded');
    } catch {
      message.error('Image upload failed. Please try again.');
      setImage((s) => ({ ...s, busy: false }));
    }
  }, [upload, image.existing, message]);

  const remove = useCallback(async () => {
    if (image.existing?.fileId) await deleteFile(image.existing.fileId).catch(() => message.error('Failed to remove image.'));
    setImage({ url: null, existing: null, staged: null, busy: false });
  }, [image.existing, message]);

  const uploadStaged = useCallback(async (sheetId) => {
    if (!image.staged) return;
    try {
      const saved = await upload(image.staged, sheetId, null);
      setImage((s) => ({ ...s, existing: saved, staged: null }));
    } catch {
      message.warning('Cost sheet saved, but the garment image upload failed. You can upload it again.');
    }
  }, [image.staged, upload, message]);

  return { ...image, load, select, remove, uploadStaged };
}
