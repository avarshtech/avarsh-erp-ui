import { useEffect, useReducer, useRef, useState } from 'react';
import { App } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';
import { getGpo } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { gpoReducer, initialGpoState, newGpoDoc } from './gpoReducer';

/**
 * Loads a Garment Process PO, or starts a draft. After its first save a new PO moves onto
 * its own URL with the saved document already in state, so that move does not reload it.
 */
const useGarmentProcessPo = (id) => {
  const { message } = App.useApp();
  const [state, dispatch] = useReducer(gpoReducer, initialGpoState);
  const [loading, setLoading] = useState(true);
  const heldId = useRef(null);
  useEffect(() => { heldId.current = state.doc?.id ?? null; });

  useEffect(() => {
    if (id && String(id) === String(heldId.current)) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const doc = id ? await getGpo(id) : newGpoDoc();
        if (alive) dispatch({ type: 'LOADED', doc });
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not load the Garment Process PO');
        if (alive) dispatch({ type: 'LOAD_FAILED' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, message]);

  return { ...state, dispatch, loading };
};

export default useGarmentProcessPo;
