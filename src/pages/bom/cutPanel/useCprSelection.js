import { useMemo, useState } from 'react';
import { App } from 'antd';
import { CPR_VAL, EXPANSION_WARN_LIMIT, OTHER_PROCESS_NAME } from '../../../utils/cutPanelConstants';
import { ALL_COLOURS, colourOptions } from './cprSelectionOptions';

const EMPTY = { fabricId: undefined, colors: [], panelIds: [], processIds: [], otherName: '' };

/**
 * State of the Cut Panel Selection strip. `add` checks the selection (VAL-03, the
 * "Other" name, VAL-07), confirms an expansion above EXPANSION_WARN_LIMIT lines, then
 * hands it to `onAdd(selection)`, which returns { added, skipped }.
 */
const useCprSelection = ({ order, fabrics, processes, parts, defaultAllowance, onAdd }) => {
  const { message, modal } = App.useApp();
  const [sel, setSel] = useState(EMPTY);
  const [allowance, setAllowance] = useState(defaultAllowance);
  const set = (patch) => setSel((s) => ({ ...s, ...patch }));

  const fabric = fabrics.find((f) => f.id === sel.fabricId);
  const chosenProcesses = useMemo(() => sel.processIds.map((id) => processes.find((p) => p.id === id)).filter(Boolean), [sel.processIds, processes]);
  const needsOther = chosenProcesses.some((p) => p.processName === OTHER_PROCESS_NAME);

  // "Select All Colours" takes the listed colours: the order's colours that carry this fabric.
  const allColours = () => colourOptions(order, fabric).map((o) => o.value).filter((v) => v !== ALL_COLOURS);
  const onColours = (vals) => set({ colors: vals.includes(ALL_COLOURS) ? allColours() : vals });
  const reset = () => { setSel(EMPTY); setAllowance(defaultAllowance); };

  const add = () => {
    if (!fabric || !sel.colors.length || !sel.panelIds.length || !chosenProcesses.length) { message.warning(CPR_VAL.VAL_03); return; }
    if (needsOther && !sel.otherName.trim()) { message.warning(CPR_VAL.OTHER_NAME); return; }
    if (allowance == null || allowance < 0) { message.warning(CPR_VAL.VAL_07); return; }
    const go = () => {
      const { added, skipped } = onAdd({
        fabric,
        colorNames: sel.colors,
        panels: sel.panelIds.map((id) => parts.find((p) => p.id === id)).filter(Boolean),
        processes: chosenProcesses.map((p) => ({ ...p, otherName: p.processName === OTHER_PROCESS_NAME ? sel.otherName.trim() : null })),
        allowancePct: allowance,
      });
      if (added) message.success(`${added} line(s) added to the grid`);
      if (skipped) message.warning(`${skipped} line(s) already exist and were skipped`);
    };
    const count = sel.colors.length * sel.panelIds.length * chosenProcesses.length;
    if (count <= EXPANSION_WARN_LIMIT) { go(); return; }
    modal.confirm({
      title: `This adds ${count} lines`,
      content: `That is more than ${EXPANSION_WARN_LIMIT} lines in one step. Continue?`,
      okText: 'Add lines',
      onOk: go,
    });
  };

  return { sel, set, allowance, setAllowance, fabric, chosenProcesses, needsOther, onColours, reset, add };
};

export default useCprSelection;
