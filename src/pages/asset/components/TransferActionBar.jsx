import { Space } from 'antd';
import { ActionButton } from '../../../components/buttons';

/**
 * The buttons the state machine currently allows.
 *
 * `allowedActions` comes from the server, which computes it from the same
 * transition map it will enforce. The screen therefore offers exactly the
 * buttons the server would honour instead of one it is about to refuse.
 *
 * Printing the challan is not one of those actions: it is not a transition and
 * it changes nothing. It appears whenever a challan number exists, including on
 * a completed move, because the receiving unit asks for a copy of the document
 * they signed more often than anybody prints the first one.
 */
const TransferActionBar = ({ transfer, onEdit, onSubmit, onDialog, onReceive, onPrintChallan }) => {
  const can = (action) => transfer?.allowedActions?.includes(action);

  return (
    <Space>
      {transfer?.challanNo && (
        <ActionButton action="print" text="Print Challan" onClick={onPrintChallan} />
      )}
      {can('edit') && <ActionButton action="edit" text="Edit" onClick={onEdit} />}
      {can('submit') && <ActionButton action="custom" text="Submit" onClick={onSubmit} />}
      {can('approve') && <ActionButton action="approve" text="Approve" onClick={() => onDialog('approve')} />}
      {can('reject') && <ActionButton action="reject" text="Reject" onClick={() => onDialog('reject')} />}
      {can('dispatch') && <ActionButton action="custom" text="Mark Dispatched" onClick={() => onDialog('dispatch')} />}
      {can('complete') && <ActionButton action="custom" text="Complete Move" onClick={() => onDialog('complete')} />}
      {can('receive') && <ActionButton action="custom" text="Receive" onClick={onReceive} />}
      {can('cancel') && <ActionButton action="cancel" text="Cancel" onClick={() => onDialog('cancel')} />}
    </Space>
  );
};

export default TransferActionBar;
