import { useEffect, useState } from 'react';

const NONE = {};

/** A server list's filter values (`load()` resolves to `{ name: [values] }`), read once; empty until they arrive. */
const useFilterOptions = (load) => {
  const [options, setOptions] = useState(NONE);

  useEffect(() => {
    let alive = true;
    load().then((o) => { if (alive) setOptions(o || NONE); }).catch(() => { /* the filter just offers nothing */ });
    return () => { alive = false; };
  }, [load]);

  return options;
};

/** Plain text values as Select options. */
export const textOptions = (values) => (values || []).map((v) => ({ value: v, label: v }));

export default useFilterOptions;
