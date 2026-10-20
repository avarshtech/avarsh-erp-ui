import { Button, Popover, Typography } from 'antd';
import StickyActionBar from '../../../../components/StickyActionBar';
import { ActionButton } from '../../../../components/buttons';
import ChangeReview from './ChangeReview';

const { Text } = Typography;

/**
 * The editor's bar. Editing, it counts the unsaved changes and lists them on Review; adding, it
 * says what the new role will hold. Save is held back, with the reason, until the role grants something.
 */
const RoleActionBar = ({ isNew, changes, groups, rightsText, onOpenSection, saving, saveReason, onCancel, onSave }) => {
  const n = changes.length;
  let summary;
  if (isNew) summary = <Text>{rightsText}</Text>;
  else if (n === 0) summary = <Text type="secondary">No changes yet</Text>;
  else {
    summary = (
      <span>
        <Text strong>{n} unsaved {n === 1 ? 'change' : 'changes'}</Text>{' '}
        <Popover
          trigger="click"
          placement="topLeft"
          title="Changes since this role was opened"
          content={<ChangeReview groups={groups} onOpen={onOpenSection} />}
        >
          <Button type="link" size="small">Review</Button>
        </Popover>
      </span>
    );
  }

  return (
    <StickyActionBar summary={summary}>
      <ActionButton action="cancel" text="Cancel" onClick={onCancel} />
      <ActionButton
        action="save"
        text={isNew ? 'Create role' : 'Save changes'}
        loading={saving}
        disabled={Boolean(saveReason)}
        tooltip={saveReason ?? undefined}
        onClick={onSave}
      />
    </StickyActionBar>
  );
};

export default RoleActionBar;
