import { useState } from 'react';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import { CLOSE_ACTION } from './requirementDialogs';

/**
 * Close confirmation for a requirement — the reason is mandatory and permanent. `actions`
 * comes from useRequirementActions.
 */
const RequirementTransitionDialog = ({ open, onDone, actions, docLabel, docNumber }) => {
  const [reason, setReason] = useState('');
  const finish = () => { setReason(''); onDone(); };
  const confirm = async (text) => {
    if (await actions.close(text.trim())) finish();
  };

  return (
    <ApprovalReasonDialog
      open={open} onCancel={finish} onConfirm={confirm}
      loading={actions.busy === 'close'}
      action={CLOSE_ACTION}
      docLabel={docLabel} docNumber={docNumber} reason={reason} onReasonChange={setReason}
    />
  );
};

export default RequirementTransitionDialog;
