import { Input, Modal, Typography } from 'antd';

const { Text } = Typography;
const { TextArea } = Input;

/** The one modal every reason-taking bill action shares (refer back, hold, reject, overrides, …). */
const BillReasonModal = ({ cfg, text, onText, onOk, onCancel, busy }) => (
  <Modal
    open={Boolean(cfg)}
    title={cfg?.title}
    width={480}
    destroyOnHidden
    okText={cfg?.okText || 'Confirm'}
    okButtonProps={{ danger: cfg?.danger, loading: busy }}
    onOk={onOk}
    onCancel={onCancel}
  >
    <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
      {cfg?.label} — recorded on the bill's audit trail.
    </Text>
    <TextArea
      rows={4}
      value={text}
      maxLength={500}
      showCount
      autoFocus
      style={{ marginTop: 8 }}
      placeholder={cfg?.placeholder || `Minimum ${cfg?.minLength ?? 10} characters`}
      onChange={(e) => onText(e.target.value)}
    />
  </Modal>
);

export default BillReasonModal;
