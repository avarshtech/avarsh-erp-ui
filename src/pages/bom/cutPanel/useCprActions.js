import { useCallback, useState } from 'react';
import { App } from 'antd';
import {
  saveCpr, submitCpr, reviseCpr, closeCpr, deleteCpr,
} from '../../../services/bom/cutPanel/cutPanelService';
import { draftSaveErrors, runPreSubmitChecks } from '../../../utils/cutPanelCalc';
import { NO_PROCESS_LABEL } from '../../../utils/cutPanelConstants';
import useRequirementActions from '../shared/useRequirementActions';

const CPR_API = { save: saveCpr, submit: submitCpr, revise: reviseCpr, close: closeCpr, remove: deleteCpr };

/**
 * Save Draft / Submit / Save changes (a submitted CPR edited in place) / Close / Delete for
 * the CPR screen. Each resolves to true on success so a dialog can close itself. `errors`
 * holds the blocking messages of the last Save, Submit or Save changes, shown in the action bar.
 */
const useCprActions = ({ doc, dirty, order, dispatch, clearDirty, reload, onRevised }) => {
  const { modal } = App.useApp();
  const [errors, setErrors] = useState([]);
  const { busy, run, persist, revise, close, remove } = useRequirementActions({
    doc, dirty, dispatch, clearDirty, reload, onRevised, api: CPR_API, basePath: '/bom/cut-panel', closedText: 'Requirement closed',
  });

  const save = useCallback(() => {
    const errs = draftSaveErrors(doc, order);
    setErrors(errs);
    return errs.length ? Promise.resolve(false) : run('save', persist(false), 'Draft saved');
  }, [doc, order, run, persist]);

  /** Submit's checks (PRD §12.1), then the WRN-03 confirm when colours have no process, then `go`. */
  const checked = useCallback((go, verb) => {
    const { blocking, uncoveredColors } = runPreSubmitChecks(doc.lines, order, doc.orderAllowancePct);
    setErrors(blocking);
    if (blocking.length) return;
    if (!uncoveredColors.length) { go(); return; }
    modal.confirm({ // WRN-03: confirm and proceed
      title: 'Some colours have no cut-panel process',
      content: `${uncoveredColors.join(', ')} will be reported as "${NO_PROCESS_LABEL}". ${verb} anyway?`,
      okText: verb,
      onOk: go,
    });
  }, [doc, order, modal]);

  const submit = useCallback(() => checked(
    () => run('submit', persist(true), 'Submitted — the requirement is now available to the PO module'), 'Submit',
  ), [checked, run, persist]);

  const saveChanges = useCallback(() => checked(revise, 'Save changes'), [checked, revise]);

  return { busy, errors, save, submit, saveChanges, close, remove };
};

export default useCprActions;
