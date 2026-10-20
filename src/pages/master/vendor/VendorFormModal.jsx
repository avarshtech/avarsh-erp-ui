import { useEffect, useState } from 'react';
import { Alert, App, Button, Divider, Form, Modal, Spin } from 'antd';
import { createVendor, getVendor, updateVendor } from '../../../services/master/vendorService';
import { toastUnlessHandled } from '../../../utils/apiError';
import VendorPartyFields from './VendorPartyFields';
import VendorProcessFields from './VendorProcessFields';
import VendorTaxBankFields from './VendorTaxBankFields';
import { NEW_VENDOR, PRIVATE_KEYS, toPayload } from './vendorForm';

const DIVIDER = { fontSize: 13, fontWeight: 600 };

/**
 * Add or edit a vendor. The row fills the form at once (so Laya AI's fill is never overwritten by a
 * late answer); the PAN and bank details, which the list does not carry, follow from GET /vendors/{id}.
 * An update replaces them, so it is held back until they are in the form: saving after a failed load
 * would erase what is stored. A save sends the row's version and hands the saved vendor back to the
 * master to adopt.
 */
const VendorFormModal = ({ open, editing, form, processes, unsaved, setUnsaved, onClose, onSaved }) => {
  const { message, modal } = App.useApp();
  const [privateStatus, setPrivateStatus] = useState('loaded');
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(editing ? { ...NEW_VENDOR, ...editing } : NEW_VENDOR);
    setUnsaved(false);
  }, [open, editing, form, setUnsaved]);

  // Apart from the reset above, so Retry fills the PAN and bank details without discarding other edits
  useEffect(() => {
    if (!open || !editing) return undefined;
    let alive = true;
    setPrivateStatus('loading');
    getVendor(editing.id)
      .then((res) => {
        if (!alive) return;
        const detail = res?.data ?? res;
        form.setFieldsValue(Object.fromEntries(PRIVATE_KEYS.map((k) => [k, detail?.[k] ?? undefined])));
        setPrivateStatus('loaded');
      })
      .catch(() => { if (alive) setPrivateStatus('failed'); }); // the interceptor has shown the error
    return () => { alive = false; };
  }, [open, editing, attempt, form]);

  const privateReady = !editing || privateStatus === 'loaded';

  const close = () => {
    if (!unsaved) { onClose(); return; }
    modal.confirm({
      title: 'Unsaved changes',
      content: 'You have unsaved changes. Discard and close?',
      okText: 'Discard',
      cancelText: 'Continue Editing',
      onOk: onClose,
    });
  };

  const submit = async () => {
    if (!privateReady) return;
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the form shows the errors
    }
    setSubmitting(true);
    try {
      const payload = toPayload(values, editing?.version);
      const res = editing ? await updateVendor(editing.id, payload) : await createVendor(payload);
      message.success(editing ? 'Vendor updated' : 'Vendor added');
      setUnsaved(false);
      onSaved(res?.data ?? res);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save the vendor');
    } finally {
      setSubmitting(false);
    }
  };

  // forceRender: the form is mounted from the start, since Laya AI reads it while the modal is closed too
  return (
    <Modal
      title={editing ? `Update Vendor — ${editing.name}` : 'Add Vendor'}
      open={open}
      onCancel={close}
      centered
      width={960}
      forceRender
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 16 } }}
      footer={[
        <Button key="cancel" onClick={close}>Cancel</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={submit}
          disabled={!!editing && (!unsaved || !privateReady)}>
          {editing ? 'Update' : 'Save'}
        </Button>,
      ]}
    >
      {editing && privateStatus === 'failed' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="The PAN and bank details could not be loaded"
          description="Update stays off until they load: saving now would clear them."
          action={<Button size="small" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>} />
      )}
      <Spin spinning={!!editing && privateStatus === 'loading'} tip="Loading bank details…">
        <Form form={form} layout="vertical" requiredMark onValuesChange={() => setUnsaved(true)}>
          <Divider titlePlacement="start" style={{ ...DIVIDER, marginTop: 0 }}>Vendor</Divider>
          <VendorPartyFields form={form} />
          <Divider titlePlacement="start" style={DIVIDER}>Job Work</Divider>
          <VendorProcessFields form={form} processes={processes} />
          <VendorTaxBankFields />
        </Form>
      </Spin>
    </Modal>
  );
};

export default VendorFormModal;
