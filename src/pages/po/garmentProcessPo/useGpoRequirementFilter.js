import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

const EMPTY = { q: '', buyer: undefined, process: undefined, color: undefined, status: undefined, submitted: null, hideFull: true };
const options = (values) => [...new Set(values.filter(Boolean))].sort().map((v) => ({ value: v, label: v }));

/**
 * Search and filters of the requirement selection (PRD FR-02, §9): requirement no., order,
 * buyer or style text; buyer, process, colour, status and submission date; "Hide fully
 * allocated" on by default (off shows them greyed and unselectable).
 */
const useGpoRequirementFilter = (rows) => {
  const [f, setF] = useState(EMPTY);
  const set = (key) => (value) => setF((cur) => ({ ...cur, [key]: value }));
  const opts = useMemo(() => ({
    buyer: options(rows.map((r) => r.buyer)), process: options(rows.map((r) => r.processLabel)),
    color: options(rows.flatMap((r) => r.colors)), status: options(rows.map((r) => r.status)),
  }), [rows]);
  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const [from, to] = f.submitted || [];
    return rows.filter((r) => (!f.hideFull || r.balance > 0)
      && (!q || [r.gprNo, r.orderNo, r.buyer, r.styleNo].some((v) => String(v).toLowerCase().includes(q)))
      && (!f.buyer || r.buyer === f.buyer) && (!f.process || r.processLabel === f.process)
      && (!f.color || r.colors.includes(f.color)) && (!f.status || r.status === f.status)
      && (!from || !dayjs(r.submittedOn).isBefore(from, 'day')) && (!to || !dayjs(r.submittedOn).isAfter(to, 'day')));
  }, [rows, f]);
  return { f, set, opts, shown };
};

export default useGpoRequirementFilter;
