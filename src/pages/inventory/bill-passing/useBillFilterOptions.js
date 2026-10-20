import { useEffect, useMemo, useState } from 'react';
import { listBpSuppliers, listBillablePos } from '../../../services/inventory/billPassingService';
import { getJobWorkBillFilterOptions } from '../../../services/inventory/jobWorkBill/jobWorkBillService';
import { typedValue, untype } from '../../../services/inventory/billListService';
import { BILL_SOURCE, isJobWorkSource } from '../../../utils/jobWorkBillConstants';

/**
 * The list's Party and PO filter options for the chosen source. Values are typed (`S:` supplier side, `J:`
 * job-work side) because the two sides' ids overlap; on All each label also says which side it is.
 */
export default function useBillFilterOptions(source, party, refreshKey) {
  const withSupplier = source === 'ALL' || source === BILL_SOURCE.SUPPLIER_PO;
  const jwSources = useMemo(() => (source === 'ALL'
    ? [BILL_SOURCE.CUT_PANEL_PO, BILL_SOURCE.GARMENT_PROCESS_PO]
    : (isJobWorkSource(source) ? [source] : [])), [source]);
  const [partySide, partyId] = untype(party);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierPos, setSupplierPos] = useState([]);
  const [jw, setJw] = useState({ parties: [], pos: [] });

  useEffect(() => {
    if (!withSupplier) return;
    listBpSuppliers().then((res) => setSuppliers(res || [])).catch(() => setSuppliers([]));
  }, [withSupplier]);

  // Each list is fetched only where it applies, and ignored where it does not — never cleared from an effect.
  const supplierPosApply = withSupplier && partySide !== 'J';
  useEffect(() => {
    if (!supplierPosApply) return undefined;
    let alive = true;
    listBillablePos({ supplierId: partySide === 'S' ? partyId : undefined })
      .then((res) => { if (alive) setSupplierPos(res || []); })
      .catch(() => { if (alive) setSupplierPos([]); });
    return () => { alive = false; };
  }, [supplierPosApply, partySide, partyId]);

  useEffect(() => {
    if (!jwSources.length) return undefined;
    let alive = true;
    getJobWorkBillFilterOptions(jwSources).then((res) => { if (alive) setJw(res); }).catch(() => {});
    return () => { alive = false; };
  }, [jwSources, refreshKey]);

  return useMemo(() => {
    const both = source === 'ALL';
    const tag = (label, side) => (both ? `${label} · ${side === 'S' ? 'Supplier' : 'Vendor'}` : label);
    const jwParties = jwSources.length ? jw.parties : [];
    const jwPos = jwSources.length && partySide !== 'S' ? jw.pos : [];
    const partyOptions = [
      ...(withSupplier ? suppliers.map((s) => ({ value: typedValue('S', s.id), label: tag(s.name, 'S') })) : []),
      ...jwParties.map((v) => ({ value: typedValue('J', v.id), label: tag(v.name, 'J') })),
    ];
    const poOptions = [
      ...(supplierPosApply ? supplierPos.map((p) => ({ value: typedValue('S', p.id), label: p.poNumber })) : []),
      ...jwPos.filter((p) => partySide !== 'J' || p.partyId === partyId).map((p) => ({ value: typedValue('J', p.id), label: p.poNumber })),
    ];
    return { partyOptions, poOptions };
  }, [source, withSupplier, suppliers, supplierPosApply, supplierPos, jwSources, jw, partySide, partyId]);
}
