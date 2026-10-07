import { useCallback, useMemo, useState } from 'react';
import useGpoRequirementRows from './useGpoRequirementRows';
import useGpoRequirementCells from './useGpoRequirementCells';
import {
  orderOptions, gprOptions, pickerProcess, cellBlockReason, normalisePicked,
} from '../../../utils/gpoRequirementPicker';

/**
 * State of the Garment Process PO's requirement picker (Select Garment Process Requirement): the order and requirement
 * picked, the ticked cells — one process per PO — and why any other cell cannot be ticked.
 * Picking a requirement fills its order; changing the order drops a requirement not on it.
 */
const useGpoRequirementPicker = ({ lines, refresh }) => {
  const [pick, setPick] = useState({ orderId: undefined, gprId: undefined, picked: [] });
  const rows = useGpoRequirementRows({ enabled: true, refresh });
  const { cells, loading } = useGpoRequirementCells(pick.gprId, refresh);
  const poProcess = lines[0]?.processLabel ?? null;
  const onPo = useMemo(() => new Set(lines.map((l) => `${l.gprId}|${l.gprLineKey}|${l.color}|${l.size}`)), [lines]);
  const process = pickerProcess(poProcess, cells, pick.picked);
  const blockOf = useCallback((c) => cellBlockReason(c, { onPo, process }), [onPo, process]);

  const orders = useMemo(() => orderOptions(rows.rows), [rows.rows]);
  const gprs = useMemo(() => gprOptions(rows.rows, pick.orderId), [rows.rows, pick.orderId]);

  const selectOrder = useCallback((orderId) => setPick((p) => (rows.rows.some((r) => r.gprId === p.gprId && r.orderId === orderId)
    ? { ...p, orderId } : { orderId, gprId: undefined, picked: [] })), [rows.rows]);
  const selectGpr = useCallback((gprId) => setPick({ gprId, orderId: rows.rows.find((r) => r.gprId === gprId)?.orderId, picked: [] }), [rows.rows]);
  const setPicked = useCallback((keys) => setPick((p) => ({ ...p, picked: normalisePicked(cells, keys, poProcess, onPo) })), [cells, poProcess, onPo]);
  const clearPicked = useCallback(() => setPick((p) => ({ ...p, picked: [] })), []);

  const chosen = cells.filter((c) => pick.picked.includes(c.key) && !blockOf(c));
  return {
    ...pick, orders, gprs, cells, process, chosen, blockOf, loading: loading || rows.loading, selectOrder, selectGpr, setPicked, clearPicked,
  };
};

export default useGpoRequirementPicker;
