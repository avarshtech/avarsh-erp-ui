import {
  getCpr, getCprEligibleOrders, getCprOrderContext, getCprsForOrder,
} from '../../../services/bom/cutPanel/cutPanelService';
import useRequirementDocument from '../shared/useRequirementDocument';
import { cprReducer, initialCprState, newCprDoc } from './cprReducer';

const CPR_DOCUMENT = {
  reducer: cprReducer,
  initialState: initialCprState,
  newDoc: newCprDoc,
  api: { get: getCpr, eligibleOrders: getCprEligibleOrders, orderContext: getCprOrderContext, forOrder: getCprsForOrder },
  noun: 'cut panel requirement',
};

/**
 * Loads a Cut Panel Requirement (or starts a new one) with its order context, the
 * eligible orders and the order's other requirements (WRN-07).
 */
const useCutPanelRequirement = (id) => useRequirementDocument(id, CPR_DOCUMENT);

export default useCutPanelRequirement;
