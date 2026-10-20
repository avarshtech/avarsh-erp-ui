import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFactoryRules, saveFactoryRules } from '../../../services/virtual-factory/virtualFactoryRulesService';
import { mergeRules, toSavedRules } from '../engine/healthRules';

const stateOf = (doc) => ({ saved: doc?.rules || {}, version: doc?.version ?? null, updatedAt: doc?.updatedAt || null, loaded: true });

/**
 * The organisation's Factory Health rules: built-in defaults until the saved copy arrives, then the
 * saved copy merged over them. `save` replaces the saved copy (superusers only, version-checked); when
 * it fails — someone else saved first — the current copy is read again, so the next save is not stale.
 */
export const useHealthRules = () => {
  const [state, setState] = useState({ saved: null, version: null, updatedAt: null, loaded: false });

  useEffect(() => {
    let alive = true;
    getFactoryRules()
      .then((doc) => alive && setState(stateOf(doc)))
      .catch(() => alive && setState((s) => ({ ...s, loaded: true })));
    return () => { alive = false; };
  }, []);

  const rules = useMemo(() => mergeRules(state.saved), [state.saved]);

  const save = useCallback(async (next) => {
    try {
      const doc = await saveFactoryRules(toSavedRules(next), state.version);
      setState(stateOf(doc));
      return doc;
    } catch (error) {
      getFactoryRules().then((doc) => setState(stateOf(doc))).catch(() => {});
      throw error;
    }
  }, [state.version]);

  return { rules, save, version: state.version, updatedAt: state.updatedAt, loaded: state.loaded, saved: state.saved };
};
