import { useCallback, useEffect, useMemo, useState } from 'react';

const merge = (base, over) => Object.fromEntries(Object.entries(base || {}).map(([c, stages]) => [c, { ...stages, ...(over?.[c] || {}) }]));

/**
 * What the coordinator has typed, per job, kept apart from the loaded sheet so a refetch (a stale
 * job, another tab's change) re-applies the edits on the new base figures. Guards a browser close
 * while anything is unsaved; in-app tab switches keep the edits because the tab stays mounted.
 */
const useSheetEdits = (sheet) => {
  const [edits, setEdits] = useState({});
  const sheetKey = `${sheet?.vendor?.id}|${sheet?.date}`;
  const [editsFor, setEditsFor] = useState(sheetKey);
  if (editsFor !== sheetKey) {
    // Another vendor or date: start clean (React's "adjust state when a prop changes", not an effect).
    setEditsFor(sheetKey);
    setEdits({});
  }

  const setCell = useCallback((jobId, colour, stage, value) => setEdits((e) => ({
    ...e, [jobId]: { ...e[jobId], cells: { ...e[jobId]?.cells, [colour]: { ...e[jobId]?.cells?.[colour], [stage]: value } } },
  })), []);
  const setField = useCallback((jobId, field, value) => setEdits((e) => ({ ...e, [jobId]: { ...e[jobId], [field]: value } })), []);
  const discard = useCallback((jobIds) => setEdits((e) => (jobIds
    ? Object.fromEntries(Object.entries(e).filter(([id]) => !jobIds.includes(Number(id)))) : {})), []);

  const view = useCallback((job) => {
    const ed = edits[job.jobId] || {};
    return {
      ...job,
      cells: merge(job.cells, ed.cells),
      flag: ed.flag ?? job.flag,
      revisedDue: ed.revisedDue !== undefined ? ed.revisedDue : job.revisedDue,
      issueCategory: ed.issueCategory ?? job.issueCategory,
      remarks: ed.remarks ?? job.remarks,
      source: ed.source ?? job.source,
      noMovement: Boolean(ed.noMovement),
      dirty: Boolean(edits[job.jobId]),
    };
  }, [edits]);

  const dirtyIds = useMemo(() => Object.keys(edits).map(Number), [edits]);

  useEffect(() => {
    if (!dirtyIds.length) return undefined;
    const warn = (ev) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyIds.length]);

  return { setCell, setField, discard, view, dirtyIds };
};

export default useSheetEdits;
