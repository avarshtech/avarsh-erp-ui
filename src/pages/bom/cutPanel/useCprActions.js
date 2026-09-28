import { useCallback, useState } from 'react';
import { App } from 'antd';
import {
  saveCpr, submitCpr, reopenCpr, closeCpr, deleteCpr,
} from '../../../services/bom/cutPanel/cutPanelService';
import { draftSaveErrors, runPreSubmitChecks } from '../../../utils/cutPanelCalc';
import { NO_PROCESS_LABEL } from '../../../utils/cutPanelConstants';
import useRequirementActions from '../shared/useRequirementActions';

const CPR_API = { save: saveCpr, submit: submitCpr, reopen: reopenCpr, close: closeCpr, remove: deleteCpr };

/**
 * Save Draft / Submit / Reopen / Close / Delete for the CPR screen. Each resolves to
 * true on success so a dialog can close itself. `errors` holds the blocking messages
 * of the last Save or Submit, shown in the action bar.
 */
const useCprActions = ({ doc, dirty, order, dispatch, clearDirty }) => {
  const { modal } = App.useApp();
  const [errors, setErrors] = useState([]);
  const { busy, run, persist, reopen, close, remove } = useRequirementActions({
    doc, dirty, dispatch, clearDirty, api: CPR_API, basePath: '/bom/cut-panel', closedText: 'Requirement closed',
  });

  const save = useCallback(() => {
    const errs = draftSaveErrors(doc, order);
    setErrors(errs);
    return errs.length ? Promise.resolve(false) : run('save', persist(false), 'Draft saved');
  }, [doc, order, run, persist]);

  const submit = useCallback(() => {
    const { blocking, uncoveredColors } = runPreSubmitChecks(doc.lines, order, doc.orderAllowancePct);
    setErrors(blocking);
    if (blocking.length) return;
    const go = () => run('submit', persist(true), 'Submitted — the requirement is now available to the PO module');
    if (!uncoveredColors.length) { go(); return; }
    modal.confirm({ // WRN-03: confirm and proceed
      title: 'Some colours have no cut-panel process',
      content: `${uncoveredColors.join(', ')} will be reported as "${NO_PROCESS_LABEL}". Submit anyway?`,
      okText: 'Submit',
      onOk: go,
    });
  }, [doc, order, run, persist, modal]);

  return { busy, errors, save, submit, reopen, close, remove };
};

export default useCprActions;
