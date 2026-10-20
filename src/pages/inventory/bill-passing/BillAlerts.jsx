import { Alert } from 'antd';
import { EXCEPTION_SEVERITY, getBillReason } from '../../../utils/billPassingConstants';

const list = (items) => <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((t) => <li key={t}>{t}</li>)}</ul>;

/**
 * What a bill workspace says above its sections: why it is back with the clerk or parked, a duplicate-invoice
 * override, what blocks approval outright, what needs an override reason, and what is only a warning.
 */
const BillAlerts = ({ bill }) => {
  const reason = getBillReason(bill);
  const ofSeverity = (s) => (bill.exceptions || []).filter((x) => x.severity === s).map((x) => `${x.title} — ${x.detail}`);
  const overridable = ofSeverity(EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE);
  const warnings = ofSeverity(EXCEPTION_SEVERITY.WARN);
  const gap = { marginBottom: 16 };
  return (
    <>
      {reason && <Alert type={reason.type} showIcon style={gap} title={reason.label} description={reason.text} />}
      {/* Not status-gated: whoever approves this payable must see the check was set aside, and why. */}
      {bill.duplicateOverrideReason && (
        <Alert type="warning" showIcon style={gap} title="The duplicate invoice check was overridden on this bill"
          description={bill.duplicateOverrideReason} />
      )}
      {bill.blockers?.length > 0 && (
        <Alert type="error" showIcon style={gap}
          title={`${bill.blockers.length} blocker${bill.blockers.length > 1 ? 's' : ''} must be cleared before this bill can be passed`}
          description={list(ofSeverity(EXCEPTION_SEVERITY.BLOCK))} />
      )}
      {overridable.length > 0 && (
        <Alert type="warning" showIcon style={gap} title="Sending for approval needs an override reason" description={list(overridable)} />
      )}
      {warnings.length > 0 && (
        <Alert type="info" showIcon style={gap} title={`${warnings.length} thing${warnings.length > 1 ? 's' : ''} to note`} description={list(warnings)} />
      )}
    </>
  );
};

export default BillAlerts;
