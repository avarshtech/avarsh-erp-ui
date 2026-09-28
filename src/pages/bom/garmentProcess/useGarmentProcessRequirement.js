import {
  getGpr, getGprEligibleOrders, getGprOrderContext, getGprsForOrder,
} from '../../../services/bom/garmentProcess/garmentProcessService';
import useRequirementDocument from '../shared/useRequirementDocument';
import { gprReducer, initialGprState, newGprDoc } from './gprReducer';

const GPR_DOCUMENT = {
  reducer: gprReducer,
  initialState: initialGprState,
  newDoc: newGprDoc,
  api: { get: getGpr, eligibleOrders: getGprEligibleOrders, orderContext: getGprOrderContext, forOrder: getGprsForOrder },
  noun: 'garment process requirement',
};

/**
 * Loads a Garment Process Requirement (or starts a new one) with its order context,
 * the eligible orders and the order's other open requirements (PRD OP-2).
 */
const useGarmentProcessRequirement = (id) => useRequirementDocument(id, GPR_DOCUMENT);

export default useGarmentProcessRequirement;
