/**
 * The principal's material: Material In (/api/v1/job-work/inward/material-in*) and Party Stock
 * (/api/v1/job-work/inward/party-stock*, issues through Material Issue's party-lot mode). Mock-only for now.
 */
import * as materialIn from './inwardMockMaterialIn';
import * as stock from './inwardMockPartyStock';

export const searchInwards = async (filters) => materialIn.searchInwards(filters);
export const getInwardForm = async (jobOrderId) => materialIn.getInwardForm(jobOrderId);
export const postInward = async (payload) => materialIn.postInward(payload);
export const cancelInward = async (id, body) => materialIn.cancelInward(id, body);
export const getInwardReport = async (id) => materialIn.getInwardReport(id);
export const getPartyStock = async (filters) => stock.getPartyStock(filters);
export const getIssueTargets = async (jobOrderId) => stock.getIssueTargets(jobOrderId);
export const issueToProduction = async (payload) => stock.issueToProduction(payload);
export const lotAction = async (payload) => stock.lotAction(payload);
export const recordWasteSale = async (payload) => stock.recordWasteSale(payload);
