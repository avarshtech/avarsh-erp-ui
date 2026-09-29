import { useEffect, useState } from 'react';
import { gpoRequirementCells } from '../../../services/po/garmentProcessPo/garmentProcessPoService';

const NONE = [];

/**
 * The colour × size cells of one Garment Process Requirement for the picker. `refresh` is
 * any value that changes when balances may have moved (the PO's version and line count).
 */
const useGpoRequirementCells = (gprId, refresh) => {
  const [state, setState] = useState({ key: null, cells: NONE });
  const key = gprId ? `${gprId}|${refresh}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    gpoRequirementCells(gprId)
      .then((cells) => { if (alive) setState({ key, cells }); })
      .catch(() => { if (alive) setState({ key, cells: NONE }); });
    return () => { alive = false; };
  }, [key, gprId]);

  return { cells: state.key === key ? state.cells : NONE, loading: Boolean(key) && state.key !== key };
};

export default useGpoRequirementCells;
