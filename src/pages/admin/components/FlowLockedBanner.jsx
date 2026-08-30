import { useState } from 'react';
import { Alert, App, Button } from 'antd';
import { CopyOutlined, LockOutlined } from '@ant-design/icons';
import { cloneApprovalFlow } from '../../../services/core/approvalFlowService';

/**
 * Shown when a flow already has approval requests: levels are locked to protect
 * the audit trail (apv_actions bind to levels by number, not FK). Clone & Edit
 * is the supported way to change a used flow's structure.
 */
const FlowLockedBanner = ({ flow, onCloned }) => {
  const { message } = App.useApp();
  const [cloning, setCloning] = useState(false);

  const handleClone = async () => {
    setCloning(true);
    try {
      const clone = await cloneApprovalFlow(flow.id);
      message.success(`Cloned as "${clone.name}" (inactive). Edit it, then activate.`);
      onCloned?.(clone);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to clone flow');
    } finally {
      setCloning(false);
    }
  };

  return (
    <Alert
      type="warning"
      showIcon
      icon={<LockOutlined />}
      style={{ marginBottom: 16 }}
      message="Approval levels are locked"
      description={'Documents have already been routed through this flow, so its levels are read-only — '
        + 'editing them would corrupt the audit history of past approvals. You can still change the name, '
        + 'description, priority, conditions and active state. To restructure levels, clone this flow, '
        + 'edit the clone, then activate it and deactivate this one.'}
      action={
        <Button icon={<CopyOutlined />} loading={cloning} onClick={handleClone}>
          Clone &amp; Edit
        </Button>
      }
    />
  );
};

export default FlowLockedBanner;
