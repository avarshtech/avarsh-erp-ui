/**
 * Master-data lookups for the Export Documentation mock.
 *
 * Everything here is a data gap the API phase owes (see the plan's data-gap
 * ledger): ports, incoterms, garment HS codes, buyer commercial profiles,
 * sub-clients and a date-addressable FX master do not exist in the ERP today.
 * The one exception is the FX rate for TODAY, which has a real endpoint.
 */
import { loadDb } from './expDocMockStore';
import { delay, clone, todayStr } from './expDocMockCommon';
import { DEFAULT_BUYER_COMMERCIAL } from './expDocMockData';
import { getTodaysRate } from '../costing/costingService';

export const listPorts = async () => {
  await delay(60);
  return clone(loadDb().masters.ports);
};

export const listIncoterms = async () => {
  await delay(60);
  return clone(loadDb().masters.incoterms);
};

export const listHsCodes = async () => {
  await delay(60);
  return clone(loadDb().masters.hsCodes);
};

/** Default garment HS code for a category — mirrors the SR module's getHsnDefault. */
export const getHsDefault = (category) => {
  const rows = loadDb().masters.hsCodes;
  const hit = rows.find((r) => r.defaultForCategory === category);
  return clone(hit || rows.find((r) => r.defaultForCategory === 'Default') || rows[0] || null);
};

const normalise = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Commercial profile for a buyer, matched on code or name because the real buyer
 * master supplies ids we cannot know at seed time. Never returns null — an
 * unseeded buyer still gets a usable neutral default.
 */
export const getBuyerCommercial = (buyer) => {
  const code = normalise(buyer?.buyerCode ?? buyer?.code ?? buyer);
  const name = normalise(buyer?.buyerName ?? buyer?.name ?? buyer);
  const rows = loadDb().masters.buyerCommercial;
  const hit = rows.find(
    (r) => (code && normalise(r.buyerCode) === code) || (name && normalise(r.buyerName) === name),
  );
  return clone(hit || DEFAULT_BUYER_COMMERCIAL);
};

export const listSubClients = (buyer) => getBuyerCommercial(buyer).subClients || [];

export const getTolerancePercent = (buyer) =>
  Number(getBuyerCommercial(buyer).tolerancePercent) || 0;

export const listConsigneeProfiles = (buyer) => getBuyerCommercial(buyer).consigneeProfiles || [];

export const listNotifyProfiles = (buyer) => getBuyerCommercial(buyer).notifyProfiles || [];

export const getExporterProfileExtra = () => clone(loadDb().masters.exporterProfileExtra);

export const getTenantConfig = () => clone(loadDb().masters.tenantConfig);

/**
 * FX rate for a date. Today's rate comes from the REAL /exchange-rates/today
 * endpoint; any other date falls back to the mock table, because a historical
 * endpoint does not exist yet. The caller records which source was used so the
 * invoice can show a MASTER / MANUAL chip and audit an override.
 */
export const getFxRate = async (date, from = 'USD', to = 'INR') => {
  const rows = loadDb().masters.fxRates;
  const todayRow = rows.find((r) => r.date === date);
  // Against TODAY, not against the newest seeded row: the seed is written once and
  // the live endpoint would then only ever be consulted on the day it was written.
  const isToday = date === todayStr();

  if (isToday) {
    try {
      const live = await getTodaysRate(from, to);
      const rate = Number(live?.rate ?? live);
      // getTodaysRate returns a bare 1 when BOTH the public API and the backend
      // fail — the same value it legitimately returns for a same-currency pair. So
      // 1 is only believable when from === to; otherwise it is the failure sentinel
      // and accepting it would silently state EUR 1 = INR 1 on a customs document.
      const isFailureSentinel = rate === 1 && from !== to;
      if (Number.isFinite(rate) && rate > 0 && !isFailureSentinel) {
        return { rate, source: 'MASTER', date, from, to, live: true };
      }
    } catch {
      /* fall through to the mock table — a missing rate must not block the demo */
    }
  }

  const hit = rows.find((r) => r.date === date && r.from === from && r.to === to)
    || rows.find((r) => r.from === from && r.to === to);
  return {
    rate: Number(hit?.rate) || 0,
    source: 'MASTER',
    date: hit?.date || todayRow?.date || date,
    from,
    to,
    live: false,
  };
};
