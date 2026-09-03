import { useState } from 'react';
import { Alert, Input, InputNumber, Modal, Typography } from 'antd';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * One reason-capture modal for every action in the module that needs a
 * justification — acknowledging a warning, revising an approved document,
 * cancelling one. Lifted from the Bill Passing workspace, where a single
 * `openReason(cfg)` funnel serves eight actions.
 *
 * The reason is not decoration: PRD §14 puts it in front of the approver and in the
 * audit trail, so a minimum length is enforced rather than suggested.
 */
const AckReasonModal = ({
  open,
  title,
  label = 'Reason',
  placeholder,
  context,
  minLength = 10,
  okText = 'Save reason',
  // An action that changes a value AND needs a justification — the FX override — is
  // one decision, so it is one dialog rather than two.
  numberField = null,
  danger = false,
  confirming = false,
  onCancel,
  onSubmit,
}) => {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [value, setValue] = useState(numberField?.initial ?? null);

  // No reset effect: the parent gives this a `key` per action, so a new action
  // remounts the component and the state starts clean.

  const trimmed = text.trim();
  const tooShort = trimmed.length < minLength;
  const valueMissing = Boolean(numberField) && !(Number(value) > 0);

  return (
    <Modal
      open={open}
      title={title}
      width={MODAL_WIDTHS.SMALL}
      okText={okText}
      okButtonProps={{ danger, loading: confirming, disabled: tooShort || valueMissing }}
      onOk={() => {
        setTouched(true);
        if (!tooShort && !valueMissing) onSubmit(trimmed, value);
      }}
      onCancel={onCancel}
      destroyOnHidden
    >
      {context && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={context.title}
          description={context.message}
        />
      )}
      {numberField && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>{numberField.label}</Text>
          <InputNumber
            min={0}
            step={0.0001}
            style={{ width: '100%' }}
            value={value}
            status={touched && valueMissing ? 'error' : undefined}
            onChange={setValue}
          />
        </div>
      )}
      <Text strong style={{ display: 'block', marginBottom: 6 }}>{label}</Text>
      <TextArea
        rows={4}
        value={text}
        autoFocus
        placeholder={placeholder || (minLength > 0
          ? `At least ${minLength} characters — the approver will read this.`
          : 'Optional — recorded against the document either way.')}
        status={touched && tooShort ? 'error' : undefined}
        onChange={(e) => setText(e.target.value)}
      />
      <Text type={touched && tooShort ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
        {tooShort
          ? `${minLength - trimmed.length} more character(s) needed.`
          : 'Recorded against this document with your name and the time.'}
      </Text>
    </Modal>
  );
};

export default AckReasonModal;
