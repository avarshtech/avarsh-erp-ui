import { memo } from 'react';
import { Button, Popconfirm, Tooltip, Typography } from 'antd';
import StickyActionBar from '../../../components/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { balanceBlock } from '../../../utils/cutPanelPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const Stat = ({ label, value }) => <span><Text type="secondary">{label}</Text> <strong>{value}</strong></span>;

/**
 * ⑥ Sticky action bar (PRD §18.1/18.2): process, lines, PO qty, balance after this PO,
 * PO value and status, always visible; then the actions `buttons` lists (cppActionButtons).
 * A button with `dialog` opens that reason dialog; `confirm` asks first; the rest call on[key].
 */
const CppActionBar = memo(function CppActionBar({ doc, ctx, value, buttons, busy, errors, on, openDialog }) {
  const live = doc.lines.filter((l) => Number(l.poQty) > 0);
  const balanceAfter = balanceBlock(doc, ctx).reduce((s, b) => s + b.balanceAfter, 0);
  const render = (b) => {
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
  };
  return (
    <StickyActionBar
      errors={errors}
      summary={(
        <>
          <Stat label="Process" value={doc.process?.label ?? doc.process?.name ?? '—'} />
          <Stat label="Lines" value={live.length} />
          <Stat label="PO qty" value={`${n(live.reduce((s, l) => s + Number(l.poQty), 0))} pcs`} />
          <Stat label="Balance after" value={n(balanceAfter)} />
          <Stat label="PO value" value={`₹${value.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />
        </>
      )}
    >
      {buttons.map(render)}
    </StickyActionBar>
  );
});

export default CppActionBar;
