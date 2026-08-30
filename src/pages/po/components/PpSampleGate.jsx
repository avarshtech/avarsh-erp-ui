import { useState } from 'react';
import { Alert, Tag, Button } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { isPpApproved, isPpRevoked } from '../../../utils/productionConstants';

/**
 * PP Sample Approval gate (PRD §3.2). Renders a blocking banner when the
 * selected order's PP sample is not yet approved, a compliance banner when it
 * was revoked after approval, or a subtle confirmation tag when cleared.
 * `compact` shows just the tag (for list/table/title contexts).
 * `onMarkApproved` (optional) adds a "Mark PP Approved" action to the
 * pending banner for users with the authority to clear the gate here.
 */
const PpSampleGate = ({ status, compact = false, onMarkApproved }) => {
  const [marking, setMarking] = useState(false);
  if (!status) return null;
  const approved = isPpApproved(status);
  const revoked = isPpRevoked(status);

  if (compact) {
    if (revoked) return <Tag color="red" icon={<WarningOutlined />}>PP Revoked</Tag>;
    return approved
      ? <Tag color="green" icon={<CheckCircleOutlined />}>PP Approved</Tag>
      : <Tag color="orange" icon={<ExclamationCircleOutlined />}>PP Pending</Tag>;
  }

  if (revoked) {
    return (
      <Alert
        type="error"
        showIcon
        banner
        message="PP Sample approval was REVOKED for this order"
        description="This PO was raised while the Pre-Production sample was approved, but approval has since been revoked. Production Manager & Merchandiser should review — approved POs are not auto-cancelled (PRD §3.2)."
        style={{ marginBottom: 16 }}
      />
    );
  }

  if (approved) {
    return (
      <Alert
        type="success"
        showIcon
        banner
        message="PP Sample approved — this order is cleared for production POs."
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      banner
      message="PP Sample not yet approved for this order"
      description="The PO can be saved as a draft but cannot be submitted for approval until the Pre-Production sample is approved in the T&A calendar."
      action={onMarkApproved ? (
        <Button
          size="small"
          type="primary"
          loading={marking}
          onClick={async () => {
            setMarking(true);
            try { await onMarkApproved(); } finally { setMarking(false); }
          }}
        >
          Mark PP Approved
        </Button>
      ) : undefined}
      style={{ marginBottom: 16 }}
    />
  );
};

export default PpSampleGate;
