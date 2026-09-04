import { useCallback } from 'react';
import { App } from 'antd';
import { recordFeedback, saveFeedbackDraft } from '../../../services/sr/srService';
import { uploadFile } from '../../../services/core/fileService';
import { getSrStatusLabel } from '../../../utils/sampleRequestConstants';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Persisting a comment record: the two save actions the dialog footer drives.
 *
 * Attachments go up after the comments are saved, because an upload needs the
 * sample request to hang off. A failed upload does not roll the comments back —
 * they are safely recorded and the file can be added again, which beats losing
 * the buyer's verdict along with it.
 */
const useFeedbackSave = ({
  sr, form, importSource, unmappedValues, pendingFiles, setPendingFiles, setAttachments, onChanged, onClose,
}) => {
  const { message } = App.useApp();

  const buildDto = useCallback((v) => ({
    // Optimistic locking — the server rejects a stale version with 409
    version: sr.version,
    date: v.date ? v.date.format('YYYY-MM-DD') : null,
    from: v.from || '',
    decision: v.decision || null,
    rejectionReasonCodes: v.rejectionReasonCodes || [],
    comments: {
      fit: v.fit || '', fabricShade: v.fabricShade || '', measurement: v.measurement || '',
      workmanship: v.workmanship || '', additional: v.additional || '',
    },
    importSource,
    unmappedValues,
  }), [sr.version, importSource, unmappedValues]);

  const uploadPending = useCallback(async () => {
    if (!pendingFiles.length) return;
    const results = await Promise.allSettled(pendingFiles.map((file) => uploadFile(file, {
      module: 'SAMPLE_REQUEST',
      entity: 'SAMPLE_REQUEST',
      entityId: sr.id,
      fileCategory: 'ATTACHMENT',
    })));
    setPendingFiles([]);
    const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed = results.length - uploaded.length;
    if (failed) {
      message.warning(`Comments saved, but ${failed} attachment${failed > 1 ? 's' : ''} failed to upload. Reopen to retry.`);
    }
    setAttachments((prev) => [...prev, ...uploaded]);
  }, [pendingFiles, sr.id, setPendingFiles, setAttachments, message]);

  const saveDraft = useCallback(async () => {
    try {
      await saveFeedbackDraft(sr.id, buildDto(form.getFieldsValue()));
      await uploadPending();
      message.success('Comment record saved — status unchanged');
      onChanged?.();
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save');
    }
  }, [sr.id, form, buildDto, uploadPending, onChanged, message]);

  // Decisions are terminal (R2) — no round creation, so no special confirm
  const save = useCallback(async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    try {
      const updated = await recordFeedback(sr.id, buildDto(values));
      await uploadPending();
      message.success(`Comments saved — ${updated.srNo} is now ${getSrStatusLabel(updated.status)}`);
      onChanged?.();
      onClose?.();
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save comments');
    }
  }, [sr.id, form, buildDto, uploadPending, onChanged, onClose, message]);

  return { saveDraft, save };
};

export default useFeedbackSave;
