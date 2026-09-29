import { useCallback, useState } from 'react';
import { saveGpr, submitGpr, reviseGpr, closeGpr } from '../../../services/bom/garmentProcess/garmentProcessService';
import { validateGpr } from '../../../utils/garmentProcessCalc';
import { canSubmitGarmentProcessOverQty } from '../../../utils/permissions';
import useRequirementActions from '../shared/useRequirementActions';

const GPR_API = { save: saveGpr, submit: submitGpr, revise: reviseGpr, close: closeGpr };

/**
 * Save draft / Submit / Save changes (a submitted GPR edited in place) / Close for the GPR
 * screen (PRD §13). Errors of the last Save, Submit or Save changes are listed in the action
 * bar and the first offending line is selected.
 */
const useGprActions = ({ doc, dirty, order, dispatch, clearDirty, reload, onRevised }) => {
  const [errors, setErrors] = useState([]);
  const { busy, run, persist, revise, close } = useRequirementActions({
    doc, dirty, dispatch, clearDirty, reload, onRevised, api: GPR_API, basePath: '/bom/garment-process', closedText: 'Requirement closed — balance released',
  });

  const check = useCallback((forSubmit) => {
    const { errors: errs, firstKey } = validateGpr(doc, order, { forSubmit, canOverQty: canSubmitGarmentProcessOverQty() });
    setErrors(errs);
    if (firstKey) dispatch({ type: 'LINE_SELECTED', key: firstKey });
    return errs.length === 0;
  }, [doc, order, dispatch]);

  const save = useCallback(() => (check(false) ? run('save', persist(false), 'Draft saved') : Promise.resolve(false)), [check, run, persist]);
  const submit = useCallback(() => (check(true)
    ? run('submit', persist(true), 'Submitted — the process lines are now available to the PO module')
    : Promise.resolve(false)), [check, run, persist]);
  const saveChanges = useCallback(() => (check(true) ? revise() : Promise.resolve(false)), [check, revise]);

  return { busy, errors, save, submit, saveChanges, close };
};

export default useGprActions;
