import { useState } from 'react';
import { Modal, Input, Alert, Typography, Space, App } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { finalizeOpeningStock } from '../../../services/inventory/openingStockService';

const { Text, Paragraph } = Typography;
const REQUIRED_PHRASE = 'FINALIZE';

/**
 * Finalize confirmation — type-to-confirm modal. Mirrors destructive-action
 * UX in ERP tools where an irreversible system-wide flag is being set.
 * Backend also guards (423 if any DRAFT exists), but this is the user-facing
 * last-chance prompt.
 */
const FinalizeConfirmModal = ({ open, onClose, onFinalized, postedCount = 0 }) => {
  const { message } = App.useApp();
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = phrase.trim() === REQUIRED_PHRASE;

  const handleOk = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await finalizeOpeningStock();
      message.success('Opening stock finalized. The feature is now locked.');
      onFinalized?.();
      onClose?.();
      setPhrase('');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to finalize opening stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={<Space><LockOutlined /> Finalize Opening Stock</Space>}
      okText="Finalize"
      okButtonProps={{ type: 'primary', danger: true, disabled: !canSubmit, loading: submitting }}
      cancelText="Cancel"
      onCancel={() => { if (!submitting) { onClose?.(); setPhrase(''); } }}
      onOk={handleOk}
      maskClosable={!submitting}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message="This is irreversible."
          description={
            <>
              <Paragraph style={{ marginBottom: 8 }}>
                Finalizing will permanently lock the Opening Stock feature. After this:
              </Paragraph>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>No new batches can be created.</li>
                <li>No draft batches can be posted.</li>
                <li>Any future stock corrections must go through Stock Adjustment.</li>
              </ul>
            </>
          }
        />
        <div>
          <Text>You have <strong>{postedCount}</strong> posted batch(es) ready to finalize.</Text>
        </div>
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Type <Text code strong>{REQUIRED_PHRASE}</Text> below to confirm.
          </Paragraph>
          <Input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={REQUIRED_PHRASE}
            autoFocus
          />
        </div>
      </Space>
    </Modal>
  );
};

export default FinalizeConfirmModal;
