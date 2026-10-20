import { Button, Popconfirm, Tooltip } from 'antd';

/**
 * The buttons of a job-work PO action bar, from a list the screen builds per status and
 * permission: { key, label, primary?, danger?, dialog?, confirm?, disabledReason? }. A
 * `dialog` opens that reason dialog, `confirm` asks first, the rest call on[key]; while one
 * runs, the others wait.
 */
const JobWorkActionButtons = ({ buttons, busy, on, openDialog }) => buttons.map((b) => {
  const button = (
    <Button
      key={b.key} type={b.primary ? 'primary' : 'default'} danger={b.danger} loading={busy === b.key}
      disabled={Boolean(busy && busy !== b.key) || Boolean(b.disabledReason)}
      onClick={b.confirm ? undefined : () => (b.dialog ? openDialog(b.dialog) : on[b.key]())}
    >
      {b.label}
    </Button>
  );
  if (b.disabledReason) return <Tooltip key={b.key} title={b.disabledReason}>{button}</Tooltip>;
  if (b.confirm) return <Popconfirm key={b.key} title={`${b.label}?`} okText="Yes" onConfirm={() => on[b.key]()}>{button}</Popconfirm>;
  return button;
});

export default JobWorkActionButtons;
