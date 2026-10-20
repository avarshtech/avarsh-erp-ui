import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { App } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';
import { getCpp } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { cppReducer, initialCppState, newCppDoc } from './cppReducer';

/**
 * Loads a Cut Panel PO, or starts a draft. After its first save a new PO moves onto its
 * own URL with the saved document already in state, so that move does not reload it.
 */
const useCutPanelPo = (id) => {
  const { message } = App.useApp();
  const [state, dispatch] = useReducer(cppReducer, initialCppState);
  const [loading, setLoading] = useState(true);
  const heldId = useRef(null);
  useEffect(() => { heldId.current = state.doc?.id ?? null; });

  useEffect(() => {
    if (id && String(id) === String(heldId.current)) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const doc = id ? await getCpp(id) : newCppDoc();
        if (alive) dispatch({ type: 'LOADED', doc });
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not load the Cut Panel PO');
        if (alive) dispatch({ type: 'LOAD_FAILED' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, message]);

  /** Re-reads the saved PO in place — after an approval decision taken through the engine. */
  const docId = state.doc?.id;
  const reload = useCallback(() => (docId ? getCpp(docId)
    .then((doc) => dispatch({ type: 'LOADED', doc }))
    .catch((e) => toastUnlessHandled(message, e, 'Could not reload the Cut Panel PO')) : Promise.resolve()), [docId, message]);

  return { ...state, dispatch, loading, reload };
};

export default useCutPanelPo;
