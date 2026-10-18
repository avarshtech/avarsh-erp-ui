import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Field values for a form that renders only once its record has loaded (a spinner or skeleton shows
 * until then). Setting them on the instance before the Form mounts makes antd warn that the instance
 * is not connected to any Form, whenever the load answers faster than React renders the form. The
 * values wait here and go into the form after the first render with `ready` true, once it has mounted.
 *
 *   const setLoadedValues = useFormValuesWhenReady(form, !loading);
 *   ... setLoadedValues({ name: record.name });   // instead of form.setFieldsValue(...)
 */
export default function useFormValuesWhenReady(form, ready) {
  const pending = useRef(null);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!ready || !pending.current) return;
    form.setFieldsValue(pending.current);
    pending.current = null;
  });

  return useCallback((values) => {
    pending.current = values;
    rerender((n) => n + 1);
  }, []);
}
