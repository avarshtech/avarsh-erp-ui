import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { COSTING_STATUS } from '../../../../utils/costingConstants';
import { unlinkedRows } from '../model/payloadMapper';

/**
 * Save Draft keeps you on the sheet (a new one moves to /costing/edit/:id); Submit sends it for
 * approval and returns to the list. Messages come from the status the server returned — a sheet
 * with no approval flow is approved on submit, and says so.
 */
export default function useSheetSave({ form, persist, meta, dirty, sections, afterSave, clearDirty, instanceKey }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);

  const saveDraft = useCallback(async () => {
    if (meta.id && !dirty) {
      message.info('All changes are saved.');
      return;
    }
    const { buyerId, styleNo } = form.getFieldsValue(['buyerId', 'styleNo']);
    if (!buyerId || !styleNo) {
      message.error('Please select Buyer and Style before saving a draft.');
      return;
    }
    try {
      await form.validateFields(['sizes']);
    } catch {
      form.scrollToField('sizes');
      message.error('At least one size is required — select sizes from a size preset.');
      return;
    }
    setBusy('draft');
    try {
      const isNew = !meta.id;
      const saved = await persist(COSTING_STATUS.DRAFT);
      await afterSave(saved.id);
      message.success(isNew ? 'Cost sheet created as draft' : 'Cost sheet saved as draft');
      if (isNew) {
        // Same instance, new URL: the sheet stays as it is, including anything typed meanwhile.
        clearDirty();
        navigate(`/costing/edit/${saved.id}`, { replace: true, state: { instanceKey } });
      }
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setBusy(null);
    }
  }, [form, persist, meta.id, dirty, afterSave, clearDirty, message, navigate, instanceKey]);

  const submit = useCallback(async () => {
    if (meta.id && !dirty && meta.status !== COSTING_STATUS.DRAFT && meta.status !== COSTING_STATUS.REJECTED) {
      message.warning('No changes detected.');
      return;
    }
    try {
      await form.validateFields();
    } catch (err) {
      const errors = (err?.errorFields || []).flatMap((f) => f.errors);
      (errors.length ? errors : ['Please fill all required fields']).forEach((e) => message.error(e));
      return;
    }
    const orphans = unlinkedRows(sections);
    if (orphans.length) {
      message.error(`${orphans.length} row(s) have figures but no material or process picked. Pick one — or create it with "+ Create" — before submitting.`);
      return;
    }
    setBusy('submit');
    try {
      const isNew = !meta.id;
      const saved = await persist(COSTING_STATUS.FINAL);
      await afterSave(saved.id);
      message.success(isNew ? 'Cost sheet created and submitted' : 'Cost sheet submitted successfully');
      if (saved.status === COSTING_STATUS.APPROVED) message.info('No approval flow is set up for costing, so it was approved straight away.');
      clearDirty();
      navigate('/costing/list');
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setBusy(null);
    }
  }, [form, persist, meta.id, meta.status, dirty, sections, afterSave, clearDirty, message, navigate]);

  return { saveDraft, submit, busy };
}
