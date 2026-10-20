import { useCallback, useMemo, useState } from 'react';
import { Alert, Checkbox } from 'antd';

/**
 * The approver's sign-off on a Garment Process PO's vendor (§13): a vendor with a warn-only issue (no process,
 * approval missing or expired) is approved only with it. The warnings are the server's own (`ctx.serverEligibility`),
 * so what the approver acknowledges is exactly what the server checks; the engine's Approve dialog shows the
 * tick box (`extraContent`) and sends it as `actionData` (`buildActionData`). A tick signs off the warnings it was
 * given: when they change (another vendor, a renewed approval), it no longer counts and must be given again.
 */
const useGpoSignOff = (doc, ctx) => {
  const warnings = useMemo(() => (ctx?.serverEligibility?.issues || []).filter((i) => i.warnOnly).map((i) => i.text), [ctx]);
  const warned = warnings.join('\n');
  const [signedFor, setSignedFor] = useState(null);
  const signed = warnings.length > 0 && signedFor === warned;

  const extraContent = useCallback((key) => (key === 'APPROVE' && warnings.length ? (
    <>
      <Alert type="warning" showIcon style={{ marginBottom: 8 }} title={`${doc.vendor?.name}: ${warnings.join('; ')}`} />
      <Checkbox checked={signed} onChange={(e) => setSignedFor(e.target.checked ? warned : null)}>
        I sign off this vendor — approving records my sign-off on the PO
      </Checkbox>
    </>
  ) : null), [warnings, warned, signed, doc.vendor]);

  const buildActionData = useCallback((key) => (key === 'APPROVE' && signed
    ? { signOff: true, acknowledged: warnings } : undefined), [signed, warnings]);

  return { extraContent, buildActionData };
};

export default useGpoSignOff;
