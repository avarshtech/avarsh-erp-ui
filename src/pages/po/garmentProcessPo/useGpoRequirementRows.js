import { useEffect, useState } from 'react';
import { gpoRequirementRows } from '../../../services/po/garmentProcessPo/garmentProcessPoService';

const NONE = [];

/**
 * Requirement selection rows of a draft Garment Process PO (PRD §9): every released GPR
 * process line with its allocation. `refresh` is any value that changes when balances may
 * have moved (the PO's version and line count).
 */
const useGpoRequirementRows = ({ enabled, refresh }) => {
  const [state, setState] = useState({ key: null, rows: NONE });
  const key = enabled ? String(refresh) : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    gpoRequirementRows().then((rows) => { if (alive) setState({ key, rows }); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  return { rows: state.key === key ? state.rows : NONE, loading: Boolean(key) && state.key !== key };
};

export default useGpoRequirementRows;
