import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import {
  getCategories, getSections, getUnitOptions, getDepartmentOptions, getSupplierOptions,
} from '../services/asset/assetService';
import { toastUnlessHandled } from '../utils/apiError';

/**
 * Everything the asset screens pick from, loaded once.
 *
 * All four lists are small and change rarely, so one load per screen beats a
 * request per dropdown. A failure is reported once rather than four times.
 */
const useAssetLookups = () => {
  const { message } = App.useApp();
  const [data, setData] = useState({ categories: [], sections: [], units: [], departments: [], suppliers: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categories, sections, units, departments, suppliers] = await Promise.all([
        getCategories(), getSections(), getUnitOptions(), getDepartmentOptions(), getSupplierOptions(),
      ]);
      setData({ categories, sections, units, departments, suppliers });
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the asset categories and locations');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const options = useMemo(() => ({
    categories: data.categories.map((c) => ({ value: c.id, label: c.name })),
    units: data.units.map((u) => ({ value: u.id, label: u.label })),
    suppliers: data.suppliers.map((s) => ({ value: s.id, label: s.label })),
  }), [data]);

  /** Sub-categories of one category; empty when it has none, which hides the field. */
  const subCategoriesOf = useCallback((categoryId) => {
    const parent = data.categories.find((c) => c.id === categoryId);
    return (parent?.subCategories ?? []).map((s) => ({ value: s.id, label: s.name }));
  }, [data.categories]);

  /** Departments of one unit. A department with no unit is offered everywhere. */
  const departmentsOf = useCallback((unitId) => data.departments
    .filter((d) => !unitId || d.parentId === null || d.parentId === unitId)
    .map((d) => ({ value: d.id, label: d.label })), [data.departments]);

  const sectionsOf = useCallback((departmentId) => data.sections
    .filter((s) => s.departmentId === departmentId)
    .map((s) => ({ value: s.id, label: s.name })), [data.sections]);

  const linesOf = useCallback((sectionId) => (data.sections
    .find((s) => s.id === sectionId)?.lines ?? [])
    .map((l) => ({ value: l.id, label: l.name })), [data.sections]);

  /**
   * The extra fields to render: the sub-category's when it defines any, else the
   * category's. Mirrors AssetDTO.fieldDefs on the server, so the form that
   * captures a value and the screen that shows it agree.
   */
  const fieldDefsFor = useCallback((categoryId, subCategoryId) => {
    const parent = data.categories.find((c) => c.id === categoryId);
    const sub = (parent?.subCategories ?? []).find((s) => s.id === subCategoryId);
    const pick = (json) => { try { return JSON.parse(json || '[]'); } catch { return []; } };
    const subDefs = pick(sub?.fieldDefs);
    return subDefs.length ? subDefs : pick(parent?.fieldDefs);
  }, [data.categories]);

  /**
   * Memoised as a whole, not just field by field.
   *
   * Everything inside was already stable, but the object wrapping them was
   * rebuilt on every render - so a screen that listed this hook's result as an
   * effect dependency re-ran that effect every render. On the asset edit form
   * that meant setLoading(true) on every pass: an infinite render loop that
   * also re-fetched the asset each time round.
   */
  return useMemo(() => ({
    ...data, options, loading, reload: load,
    subCategoriesOf, departmentsOf, sectionsOf, linesOf, fieldDefsFor,
  }), [data, options, loading, load,
    subCategoriesOf, departmentsOf, sectionsOf, linesOf, fieldDefsFor]);
};

export default useAssetLookups;
