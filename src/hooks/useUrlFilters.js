import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const parse = (params, keys, numeric) => {
  const out = {};
  keys.forEach((key) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return;
    if (numeric.includes(key)) {
      const asNumber = Number(raw);
      if (!Number.isNaN(asNumber)) out[key] = asNumber;
    } else if (raw === 'true' || raw === 'false') {
      out[key] = raw === 'true';
    } else {
      out[key] = raw;
    }
  });
  return out;
};

/**
 * Filters named in the URL, read once on the first render.
 *
 * This is what makes a dashboard's "nine transfers awaiting approval" worth
 * clicking: the link lands on the list already showing those nine, rather than
 * on everything with a filter the person has to set again by hand.
 *
 * Read once on purpose, through a state initialiser. The values seed
 * `useServerList`'s own initial filters, and re-reading the query string would
 * fight the user every time they changed a filter while the old link was still
 * in the address bar.
 *
 * Values arrive as strings, so this suits enum and text filters. `numeric`
 * names the keys to convert, for the id and day-window filters; "true" and
 * "false" become booleans, for the flag filters.
 */
const useUrlFilters = (keys = [], { numeric = [] } = {}) => {
  const [params] = useSearchParams();
  const [initial] = useState(() => parse(params, keys, numeric));
  return initial;
};

export default useUrlFilters;
