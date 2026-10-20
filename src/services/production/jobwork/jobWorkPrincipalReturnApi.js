/**
 * Returns to the principal (/api/v1/job-work/inward/returns*) and the statements: party statement,
 * job charges for Tally, status report (/api/v1/job-work/inward/statements*). Mock-only for now.
 */
import * as returns from './inwardMockReturns';
import * as statements from './inwardMockStatements';

export const searchReturns = async (filters) => returns.searchReturns(filters);
export const getReturnForm = async (jobOrderId) => returns.getReturnForm(jobOrderId);
export const postReturn = async (payload) => returns.postReturn(payload);
export const cancelReturn = async (id, body) => returns.cancelReturn(id, body);
export const getReturnPrint = async (id) => returns.getReturnPrint(id);
export const getPartyStatement = async (filters) => statements.getPartyStatement(filters);
export const listCharges = async (filters) => statements.listCharges(filters);
export const recordTallyInvoice = async (body) => statements.recordTallyInvoice(body);
export const getStatusReport = async (jobOrderId) => statements.getStatusReport(jobOrderId);
