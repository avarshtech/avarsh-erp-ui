import { useEffect, useState } from 'react';
import { cppProcessOptions, cppEligibleCprs } from '../../../services/po/cutPanelPo/cutPanelPoService';

const NONE = [];

/**
 * The requirement side of a draft Cut Panel PO: processes with the count of CPRs still
 * carrying balance (FR-07), and — once one is chosen — the CPRs for it (FR-08/09).
 * `refresh` is any value that changes when balances may have moved (e.g. the line count).
 */
const useCppRequirementLookup = ({ enabled, label, refresh }) => {
  const [processes, setProcesses] = useState({ key: null, list: NONE });
  const [cprs, setCprs] = useState({ key: null, list: NONE });
  const processKey = enabled ? `p|${refresh}` : null;
  const cprKey = enabled && label ? `${label}|${refresh}` : null;

  useEffect(() => {
    if (!processKey) return undefined;
    let alive = true;
    cppProcessOptions().then((list) => { if (alive) setProcesses({ key: processKey, list }); }).catch(() => {});
    return () => { alive = false; };
  }, [processKey]);

  useEffect(() => {
    if (!cprKey) return undefined;
    let alive = true;
    cppEligibleCprs(label).then((list) => { if (alive) setCprs({ key: cprKey, list }); }).catch(() => {});
    return () => { alive = false; };
  }, [cprKey, label]);

  return {
    processes: processes.key === processKey ? processes.list : NONE,
    cprs: cprs.key === cprKey ? cprs.list : NONE,
    loading: Boolean(cprKey) && cprs.key !== cprKey,
  };
};

export default useCppRequirementLookup;
