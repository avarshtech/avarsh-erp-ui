import { useEffect } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getCostSheetById } from '../../../../services/costing/costingService';
import { fromResponse } from '../model/payloadMapper';

/**
 * Loads the cost sheet in the URL into the header form and the sheet state. A sheet that was
 * just saved for the first time is already in memory (meta.id equals the URL id), so it is not
 * loaded again.
 */
export default function useSheetLoader(id, { form, dispatch, meta, setMeta, onLoaded }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const needsLoad = !!id && String(meta.id) !== String(id);

  useEffect(() => {
    if (!needsLoad) return undefined;
    let cancelled = false;
    getCostSheetById(id)
      .then((cs) => {
        if (cancelled) return;
        const { values, sheet, meta: loaded } = fromResponse(cs);
        form.setFieldsValue(values);
        dispatch({ type: 'LOAD', sheet });
        setMeta(loaded);
        onLoaded?.(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        message.error('Failed to load cost sheet');
        navigate('/costing/list');
      });
    return () => { cancelled = true; };
  }, [needsLoad, id, form, dispatch, setMeta, onLoaded, message, navigate]);

  return needsLoad;
}
