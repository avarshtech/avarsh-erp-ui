import { useState, useEffect, useMemo, useCallback } from 'react';
import { searchPorts } from '../../../services/master/portService';

const optionOf = (port) => ({
  value: port.id,
  label: port.label,
  country: port.countryCode ?? null,
  kind: port.kind ?? null,
});

/**
 * The ports a shipment's port picker offers, from GET /ports: of the kinds the mode uses, in the country
 * asked (India, for the port of loading), searched on the server as the user types, by code or by name,
 * former names included. The first page loads when the picker first opens.
 *
 * `value` is the port picked and `saved` the shipment's own ({ id, label }): both stay among the options,
 * so the field never shows a bare id when a later search does not return them. Results are kept per
 * kinds and country, so a seaport never lingers once the mode is Air.
 */
const usePortOptions = ({ kinds, country, value, saved }) => {
  const kindsKey = kinds.join(',');
  const scope = `${kindsKey}|${country || ''}`;

  // Typed text is kept WITH its scope: antd clears the box on select and on blur without
  // calling onSearch, so text typed for one mode must not become the next one's search.
  const [typed, setTyped] = useState({ scope: null, text: '' });
  const [settled, setSettled] = useState(typed);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const search = settled.scope === scope ? settled.text.trim() : '';

  const [opened, setOpened] = useState(false);
  const requestKey = opened || search ? `${scope}|${search}` : null;

  // The last answer, and every port seen in this scope (for the label of the one picked)
  const [answer, setAnswer] = useState({ requestKey: null, rows: [], failed: false });
  const [seen, setSeen] = useState({ scope: null, rows: {} });

  useEffect(() => {
    if (!requestKey) return undefined;
    let cancelled = false;
    searchPorts({ search, kinds: kindsKey.split(','), country })
      .then((rows) => {
        if (cancelled) return;
        setAnswer({ requestKey, rows, failed: false });
        setSeen((prev) => {
          const kept = prev.scope === scope ? { ...prev.rows } : {};
          rows.forEach((p) => { kept[p.id] = p; });
          return { scope, rows: kept };
        });
      })
      // The interceptor has already toasted; the dropdown says so in place.
      .catch(() => { if (!cancelled) setAnswer({ requestKey, rows: [], failed: true }); });
    return () => { cancelled = true; };
  }, [requestKey, search, kindsKey, country, scope]);

  const options = useMemo(() => {
    const out = (answer.requestKey === requestKey ? answer.rows : []).map(optionOf);
    const keep = (port) => { if (port && !out.some((o) => o.value === port.id)) out.unshift(optionOf(port)); };
    if (value != null) keep(seen.scope === scope ? seen.rows[value] : null);
    if (saved?.id != null && saved.id === value) keep(saved);
    return out;
  }, [answer, requestKey, value, saved, seen, scope]);

  const onSearch = useCallback((text) => setTyped({ scope, text }), [scope]);
  // Opening starts from the first page: antd clears the box on a pick without calling onSearch,
  // so the last search would otherwise still list its results under an empty box.
  const onOpenChange = useCallback((open) => {
    if (!open) return;
    setOpened(true);
    const cleared = (prev) => (prev.text ? { scope, text: '' } : prev);
    setTyped(cleared);
    setSettled(cleared);
  }, [scope]);
  const loading = Boolean(requestKey) && answer.requestKey !== requestKey;
  const failed = answer.requestKey === requestKey && answer.failed;
  return { options, loading, failed, onSearch, onOpenChange };
};

export default usePortOptions;
