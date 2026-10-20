import { useCallback } from 'react';

/**
 * Spreadsheet-style entry: Enter in a number or text cell of the LAST row adds a row and puts the
 * cursor in its first picker. Pickers keep Enter for choosing an option, so they are left alone.
 */
export default function useGridKeyboard(wrapperRef, addRow) {
  return useCallback((e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
    const target = e.target;
    if (target.tagName !== 'INPUT' || target.closest('.ant-select')) return;
    const rows = wrapperRef.current?.querySelectorAll('tbody tr.ant-table-row');
    if (!rows?.length || target.closest('tr') !== rows[rows.length - 1]) return;
    e.preventDefault();
    addRow();
    requestAnimationFrame(() => {
      const all = wrapperRef.current?.querySelectorAll('tbody tr.ant-table-row');
      const last = all?.[all.length - 1];
      last?.querySelector('.ant-select input:not([aria-label="Sizes"]), input')?.focus();
    });
  }, [wrapperRef, addRow]);
}
