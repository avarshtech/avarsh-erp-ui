// Export documents (packing lists, invoices) are kept by the API (/export-docs/documents), and a
// shipment that has any cannot be deleted. A spec's cleanup removes its shipments' documents first.

/** Deletes every packing list and invoice naming one of these shipments; returns how many went. */
export const deleteShipmentDocuments = async (api, shipmentIds) => {
  const ids = new Set(shipmentIds.map(Number));
  if (!ids.size) return 0;
  const { status, data } = await api.get('/export-docs/documents', { kinds: 'PACKING_LIST,INVOICE' });
  if (status !== 200) return 0;
  const deletes = (data || []).filter((d) => ids.has(Number(d.shipmentId))).map((d) => ({ key: d.key, version: d.version }));
  if (!deletes.length) return 0;
  const res = await api.post('/export-docs/documents/batch', { upserts: [], deletes });
  return res.status === 200 ? deletes.length : 0;
};
