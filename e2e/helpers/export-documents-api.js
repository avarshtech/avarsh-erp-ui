// Export documents for the export-docs specs: their packing lists, made and cleared through the
// REST API, and the cleanup of what a spec made.
//
// Packing lists are the API's own records (/export-docs/packing-lists) and hold the Carton Packing
// entries they bind: an entry on a live list cannot be deleted, and a shipment with any packing list
// (a cancelled one stays on record) or invoice cannot either. Invoices are still documents the web
// app keeps (/export-docs/documents); the packing lists once kept there are archived and read-only.

const PL = '/export-docs/packing-lists';
const REASON = 'E2E cleanup: the fixture is no longer needed';
const DEAD = ['CANCELLED', 'SUPERSEDED'];

/** A request that must succeed, its body in the failure. */
const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

/**
 * A packing list raised as the New Packing List dialog raises it, from what the shipment could take: the
 * units of these entries (every free one when `entryIds` is null, as the dialog ticks them), on the standard
 * layout unless `templateId` names a template.
 */
export const raisePackingList = async (api, shipmentId, entryIds = null, { templateId = null } = {}) => {
  const { orders } = ok(await api.get(`${PL}/bindable`, { shipmentId }), 'bindable');
  const units = orders.flatMap((o) => o.pos.flatMap((p) => p.units))
    .filter((u) => (entryIds == null ? u.bindable : entryIds.includes(u.packingEntryId)))
    .map((u) => ({ packingEntryId: u.packingEntryId, poKey: u.poKey ?? null }));
  return ok(await api.post(PL, { shipmentId, templateId, units }), 'create packing list');
};

/** One packing list as the workspace reads it. */
export const getPackingList = async (api, plId) => ok(await api.get(`${PL}/${plId}`), 'read packing list');

/** A POST command on a packing list (`ack`, `submit`, `release`, `cancel`, …), answered with the list. */
export const packingListCommand = async (api, plId, command, body) =>
  ok(await api.post(`${PL}/${plId}/${command}`, body), `packing list ${command}`);

/**
 * Takes one packing list out of the way: a draft is deleted, a submission withdrawn and deleted, a final or
 * released one cancelled (it stays on record). Whether it went.
 */
const retire = async (api, plId) => {
  let res = await api.get(`${PL}/${plId}`);
  if (res.status !== 200) return false;
  if (res.data.status === 'PENDING_APPROVAL') {
    res = await api.post(`${PL}/${plId}/withdraw`, { version: res.data.version });
    if (res.status !== 200) return false;
  }
  const pl = res.data;
  if (pl.status === 'DRAFT') return (await api.delete(`${PL}/${plId}?version=${pl.version}`)).status === 204;
  if (pl.status === 'FINAL' || pl.status === 'EXPORTED') {
    return (await api.post(`${PL}/${plId}/cancel`, { version: pl.version, reason: REASON })).status === 200;
  }
  return false;
};

// Deleting a draft revision brings back the revision it superseded, so each clean-up looks again
const ROUNDS = 4;

/** Frees these Carton Packing entries from every live packing list holding them, so they can be deleted. */
export const releaseEntries = async (api, entryIds) => {
  const ids = [...new Set(entryIds.map(Number))];
  for (let round = 0; ids.length && round < ROUNDS; round += 1) {
    const { status, data } = await api.get(`${PL}/by-entries`, { ids: ids.join(',') });
    if (status !== 200) return;
    const plIds = [...new Set(Object.values(data || {}).flat().map((l) => l.plId))];
    if (!plIds.length) return;
    for (const plId of plIds) await retire(api, plId);
  }
};

/**
 * Clears these shipments' documents: every live packing list is retired (a final or released one is
 * cancelled and stays on record, so its shipment is kept too), and the invoice documents are deleted.
 * Returns how many went.
 */
export const deleteShipmentDocuments = async (api, shipmentIds) => {
  const ids = new Set(shipmentIds.map(Number));
  if (!ids.size) return 0;
  let gone = 0;
  for (const shipmentId of ids) {
    for (let round = 0; round < ROUNDS; round += 1) {
      const { status, data } = await api.get(PL, { shipmentId, size: 100 });
      if (status !== 200) break;
      const live = (data.content || []).filter((pl) => !DEAD.includes(pl.status));
      if (!live.length) break;
      for (const pl of live) if (await retire(api, pl.id)) gone += 1;
    }
  }
  const { status, data } = await api.get('/export-docs/documents', { kinds: 'INVOICE' });
  if (status !== 200) return gone;
  const deletes = (data || []).filter((d) => ids.has(Number(d.shipmentId))).map((d) => ({ key: d.key, version: d.version }));
  if (deletes.length && (await api.post('/export-docs/documents/batch', { upserts: [], deletes })).status === 200) {
    gone += deletes.length;
  }
  return gone;
};
