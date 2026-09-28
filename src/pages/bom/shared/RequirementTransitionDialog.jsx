import { useState } from 'react';
import ApprovalReasonDialog from '../../../components/ApprovalReasonDialog';
import { CLOSE_ACTION, REOPEN_ACTION } from './requirementDialogs';

/**
 * Reopen / Close confirmation for a requirement (Close needs a reason). `dialog` is
 * { kind: 'reopen' | 'close', open }: the kind outlives `open`, so the dialog keeps its
 * title while it animates out. `actions` comes from useRequirementActions.
 */
const RequirementTransitionDialog = ({ dialog, onDone, actions, docLabel, docNumber }) => {
  const [reason, setReason] = useState('');
  const isClose = dialog.kind === 'close';
  const finish = () => { setReason(''); onDone(); };
  const confirm = async (text) => {
    if (await (isClose ? actions.close(text.trim()) : actions.reopen())) finish();
  };

  return (
    <ApprovalReasonDialog
      open={dialog.open} onCancel={finish} onConfirm={confirm}
      loading={actions.busy === 'close' || actions.busy === 'reopen'}
      action={isClose ? CLOSE_ACTION : REOPEN_ACTION}
      docLabel={docLabel} docNumber={docNumber} reason={reason} onReasonChange={setReason}
    />
  );
};

export default RequirementTransitionDialog;
