/**
 * Shared steps of the Time & Action specs. The plans they read are generated and kept in step by the
 * API from the orders' source records; these helpers only find the order the production-flow chain
 * made and read its plan.
 */
import { expect } from '@playwright/test';
import { FLOW_MARK } from '../../helpers/production-flow-seed.js';

export const ZARA = { id: 2, name: 'Zara (Inditex)', template: 'Zara — E2E T&A' };
export const HM = { id: 1, name: 'H&M Hennes & Mauritz', template: 'Standard — all buyers' };

export const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

/** Today in the business calendar's terms (the machine runs IST, as the API's clock does). */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The newest order the production-flow chain made (FLOW_MARK in its remarks). */
export async function newestFlowOrder(api) {
  const { data } = await api.get('/orders/search', { page: 0, size: 50, sort: 'id', direction: 'desc' });
  const hit = (data?.content || []).find((o) => String(o.remarks || '').startsWith(FLOW_MARK));
  if (!hit) throw new Error('no production-flow order yet: run production-flow/01-upstream-chain first');
  return ok(await api.get(`/orders/${hit.id}`), 'read flow order');
}

/** The order's plan as the API holds it, re-read from the sources first (the same work a save triggers). */
export async function planOf(api, orderId) {
  return ok(await api.post(`/tna/orders/${orderId}/sync`), 'sync plan');
}

export const act = (plan, code) => {
  const a = plan.activities.find((x) => x.code === code);
  expect(a, `activity ${code} is on the plan`).toBeTruthy();
  return a;
};

/** The template an order must have been planned with: Zara's own, everyone else the default. */
export const expectedTemplate = (order) => (order.buyerId === ZARA.id ? ZARA.template : HM.template);
