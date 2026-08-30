/**
 * Dev DB seeder — transactional data (cost sheets → orders → BOMs → purchase orders).
 * Run AFTER scripts/seed-dev.mjs. Reads seeded master ids by name.
 *   node scripts/seed-dev-txn.mjs
 */

const BASE = process.env.SEED_API || 'http://localhost:8088/api/v1';
const USER = process.env.SEED_USER || 'superadmin';
const PASS = process.env.SEED_PASS || 'admin123';
let TOKEN = '';
const today = () => new Date().toISOString().split('T')[0];
const future = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
const r2 = (n) => Math.round(n * 100) / 100;
const log = [];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}
const listOf = (d) => (Array.isArray(d) ? d : d?.content || []);

async function main() {
  const lr = await api('POST', '/auth/login', { username: USER, password: PASS });
  TOKEN = lr.data.token; console.log('✓ logged in');

  // ── fetch master maps ──
  const byName = (arr, key) => Object.fromEntries(arr.map((x) => [String(x[key] ?? x.name).toLowerCase(), x]));
  const buyers = byName(listOf((await api('GET', '/buyers')).data), 'name');
  const styles = byName(listOf((await api('GET', '/styles')).data), 'styleNo');
  const procs = byName(listOf((await api('GET', '/processes/active')).data), 'processName');
  const overheads = byName(listOf((await api('GET', '/overheads')).data), 'overheadName');
  const suppliers = byName(listOf((await api('GET', '/suppliers')).data), 'name');
  const pterms = byName(listOf((await api('GET', '/payment-terms')).data), 'name');
  const presets = byName(listOf((await api('GET', '/size-presets')).data), 'name');
  const tncs = byName(listOf((await api('GET', '/terms-conditions')).data), 'name');
  const itemsList = listOf((await api('GET', '/items/search?page=0&size=200')).data);
  const items = byName(itemsList, 'itemName');
  const itemByName = (n) => items[n.toLowerCase()] || itemsList.find((i) => (i.name || i.itemName || '').toLowerCase().includes(n.toLowerCase()));
  const fullBuyer = async (id) => (await api('GET', `/buyers/${id}`)).data;

  const out = { costSheets: [], orders: [], boms: [], pos: [] };

  // existing rows (idempotency: skip what's already seeded so re-runs don't duplicate)
  const existCS = listOf((await api('GET', '/cost-sheets/search?page=0&size=200')).data);
  const existOrders = listOf((await api('GET', '/orders/search?page=0&size=200')).data);
  const existBoms = listOf((await api('GET', '/boms?page=0&size=200')).data);
  const existPos = listOf((await api('GET', '/purchase-orders/search?page=0&size=200')).data);
  const csByScenario = new Set(existCS.map((c) => `${c.styleId}|${c.scenarioName}`));
  const ordersByCosting = new Set(existOrders.map((o) => o.costingId));
  const bomsByOrderNo = new Set(existBoms.map((b) => b.orderNo));
  const poBySupplierRemark = new Set(existPos.map((p) => `${p.supplierId}|${p.remarks}`));

  // ════════════════════════════ COST SHEETS ════════════════════════════
  console.log('\n── Cost Sheets ──');
  const fab = (name) => itemByName(name);
  const csSpecs = [
    { style: 'AV-SS26-POLO', type: 'FOB', fabrics: [['Cotton Pique 220 GSM', 0.28, 320]], trims: [['4-Hole Polyester Button 20L', 3, 0.5], ['Woven Main Label', 1, 1.2], ['Printed Care Label', 1, 0.8]], imp: [['Hangtag Loop', 1, 0.04]], mfg: [['Cutting', 8], ['Sewing', 25], ['Ironing & Packing', 6]], oh: [['Testing & Inspection', 15], ['Freight (Export)', 120]], agent: 4, profit: 12, submit: true },
    { style: 'AV-AW25-HOOD', type: 'FOB', fabrics: [['Polar Fleece 280 GSM', 0.62, 360], ['Cotton Interlock 200 GSM', 0.12, 300]], trims: [['Nylon Zipper 7 inch', 1, 18], ['Cotton Drawcord 8mm', 1.4, 6], ['Woven Main Label', 1, 1.2]], imp: [], mfg: [['Cutting', 10], ['Sewing', 38], ['Finishing', 5]], oh: [['Testing & Inspection', 15], ['Sampling Cost', 50]], agent: 5, profit: 14, submit: true },
    { style: 'AV-AW26-JOG', type: 'CMT', fabrics: [['French Terry 260 GSM', 0.55, 330]], trims: [['Knitted Elastic 1 inch', 0.9, 12], ['Cotton Drawcord 8mm', 1.2, 6]], imp: [], mfg: [['Cutting', 9], ['Sewing', 30], ['Ironing & Packing', 6]], oh: [['Freight (Domestic)', 25]], agent: 3, profit: 10, submit: true },
    { style: 'AV-SS26-TEE', type: 'FOB', fabrics: [['Cotton Single Jersey 180 GSM', 0.22, 300]], trims: [['Woven Main Label', 1, 1.2], ['Printed Care Label', 1, 0.8], ['Spun Polyester Sewing Thread 40s', 0.05, 220]], imp: [], mfg: [['Cutting', 7], ['Sewing', 18], ['Ironing & Packing', 6]], oh: [['Testing & Inspection', 15]], agent: 4, profit: 11, submit: true },
    { style: 'AV-SS26-SHIRT', type: 'FOB', fabrics: [['Cotton Poplin 120 GSM', 1.6, 95]], trims: [['4-Hole Polyester Button 20L', 9, 0.5], ['Woven Main Label', 1, 1.2]], imp: [], mfg: [['Cutting', 9], ['Sewing', 32], ['Finishing', 5]], oh: [['Testing & Inspection', 15], ['Freight (Export)', 120]], agent: 5, profit: 13, submit: false },
    { style: 'AV-AW26-SWEAT', type: 'FOB', fabrics: [['French Terry 260 GSM', 0.5, 330]], trims: [['Knitted Elastic 1 inch', 1.6, 12], ['Woven Main Label', 1, 1.2]], imp: [], mfg: [['Cutting', 9], ['Sewing', 28], ['Ironing & Packing', 6]], oh: [['Testing & Inspection', 15]], agent: 4, profit: 12, submit: false },
  ];

  for (const cs of csSpecs) {
    const st = styles[cs.style.toLowerCase()];
    if (!st) { log.push(`costing: style ${cs.style} missing`); continue; }
    const scenarioName = `${cs.type} base costing`;
    const existing = existCS.find((c) => c.styleId === st.id && c.scenarioName === scenarioName);
    if (existing) { out.costSheets.push({ id: existing.id, costingId: existing.costingId, status: existing.status, style: cs.style }); continue; }
    const fabricRows = cs.fabrics.map(([n, cons, price]) => {
      const it = fab(n); const netCost = r2(cons * price);
      return { itemId: it?.id, classification: 'Knits', description: n, consumption: cons, fabricPrice: price, fabricWidthStd: '60', allowancePct: 0, wastagePct: 3, sizes: '', netCost: r2(cons * price * 1.03) };
    });
    const localTrims = cs.trims.map(([n, cons, cost]) => { const it = fab(n); return { itemId: it?.id, code: it?.itemCode || '', size: '', consumption: cons, cost, sizes: '', price: r2(cons * cost) }; });
    const importedTrims = cs.imp.map(([n, cons, costUsd]) => ({ item: n, code: '', size: '', consumption: cons, costUsd, sizes: '', priceUsd: r2(cons * costUsd) }));
    const manufacturingRows = cs.mfg.map(([n, cost]) => ({ processId: procs[n.toLowerCase()]?.id, cost, comments: '', sizes: '' }));
    const overheadRows = cs.oh.map(([n, cost]) => ({ overheadId: overheads[n.toLowerCase()]?.id, cost, comments: '', sizes: '' }));

    const payload = {
      status: cs.submit ? 'Final' : 'Draft', date: today(),
      buyerId: st.buyerId, styleId: st.id, garmentName: st.garmentName,
      season: (st.seasonCode || 'SS') + String(st.seasonYear || '2026').slice(-2),
      currency: 'INR', quoteCurrency: 'USD', actualRate: 83.5, todaysRate: 83.5,
      sizes: ['S', 'M', 'L', 'XL'], costingType: cs.type, pricingUnit: 'PIECE',
      scenarioName: `${cs.type} base costing`, agentCommissionPct: cs.agent, profitPct: cs.profit, targetPrice: 0,
      fabricRows, localTrims, importedTrims, manufacturingRows, overheadRows,
      fabricNotes: 'Shell fabric as per approved swatch', trimsNotes: 'All trims buyer-nominated',
      manufacturingNotes: '', overheadNotes: '',
    };
    const res = await api('POST', '/cost-sheets', payload);
    if (!res.ok) { log.push(`costing ${cs.style}: ${res.status} ${JSON.stringify(res.data)?.slice(0, 140)}`); continue; }
    out.costSheets.push({ id: res.data.id, costingId: res.data.costingId, status: res.data.status, style: cs.style });
  }
  console.log(`cost sheets: ${out.costSheets.length} (${out.costSheets.filter((c) => c.status === 'Approved').length} approved)`);

  // ════════════════════════════ ORDERS ════════════════════════════
  console.log('── Orders ──');
  const approvedCS = out.costSheets.filter((c) => c.status === 'Approved');
  let orderIdx = 0;
  for (const cs of approvedCS) {
    if (ordersByCosting.has(cs.costingId)) { const e = existOrders.find((o) => o.costingId === cs.costingId); if (e) out.orders.push({ id: e.id, orderNo: e.orderNo, status: e.status, style: cs.style, styleId: e.styleId }); continue; }
    const full = (await api('GET', `/cost-sheets/${cs.id}`)).data;
    const buyer = await fullBuyer(full.buyerId);
    const ship = (buyer.shippingLocations || []).filter((s) => s.active);
    const preset = presets['adult alpha (xs-xxl)'];
    const sizes = preset.sizes;
    const pt = Object.values(pterms)[orderIdx % Object.keys(pterms).length];
    const sizePrices = {}; sizes.forEach((s, i) => { sizePrices[s] = r2(Number(full.finalPrice || 5) + i * 0.1); });
    const mkColor = (name, base) => { const q = {}; sizes.forEach((s, i) => { q[s] = base + i * 20; }); return { sortOrder: 0, colorName: name, quantities: q }; };
    const dest1 = ship[0] ? (ship[0].label || `${ship[0].city}, ${ship[0].country}`) : 'Main DC';
    const orderLines = [{
      lineNo: 1, buyerPoNo: `PO-${cs.style}-001`, destination: dest1,
      dispatchDate: future(45 + orderIdx * 5), leadTime: 45 + orderIdx * 5,
      sizePresetId: preset.id, sizePrices, colorRows: [mkColor('Black', 120), mkColor('Navy', 80)],
    }];
    if (ship[1]) {
      const dest2 = ship[1].label || `${ship[1].city}, ${ship[1].country}`;
      orderLines.push({ lineNo: 2, buyerPoNo: `PO-${cs.style}-002`, destination: dest2, dispatchDate: future(60), leadTime: 60, sizePresetId: preset.id, sizePrices, colorRows: [mkColor('White', 100)] });
    }
    const payload = {
      costingId: cs.costingId, buyerId: full.buyerId, buyerName: full.buyerName, orderDate: today(),
      styleId: full.styleId, styleNo: full.styleNo, garmentName: full.garmentName, garmentType: full.garmentName,
      season: full.season, fabricDescription: 'As per approved costing & swatch', material: 'Knit', component: 'Single',
      currency: full.quoteCurrency || 'USD', paymentTermsId: pt.id, paymentTermsName: pt.name, paymentDays: pt.paymentDays,
      remarks: `Bulk order against ${cs.costingId}`, orderLines,
    };
    const res = await api('POST', '/orders', payload);
    if (!res.ok) { log.push(`order ${cs.style}: ${res.status} ${JSON.stringify(res.data)?.slice(0, 140)}`); continue; }
    let status = res.data.status;
    // confirm the first 3 orders
    if (orderIdx < 3) {
      const cur = (await api('GET', `/orders/${res.data.id}`)).data;
      await api('PUT', `/orders/${res.data.id}/status`, { status: 'CONFIRMED', version: cur.version });
      status = (await api('GET', `/orders/${res.data.id}`)).data.status;
    }
    out.orders.push({ id: res.data.id, orderNo: res.data.orderNo, status, style: cs.style, styleId: full.styleId });
    orderIdx++;
  }
  console.log(`orders: ${out.orders.length} (${out.orders.filter((o) => o.status === 'CONFIRMED').length} confirmed)`);

  // ════════════════════════════ BOMs ════════════════════════════
  console.log('── BOMs ──');
  const confirmedOrders = out.orders.filter((o) => o.status === 'CONFIRMED');
  const fabricItem = itemByName('Cotton Single Jersey');
  const part = listOf((await api('GET', '/parts/active')).data)[0];
  let bomIdx = 0;
  for (const ord of confirmedOrders) {
    if (bomsByOrderNo.has(ord.orderNo)) { continue; }
    const order = (await api('GET', `/orders/${ord.id}`)).data;
    const orderQty = order.totalOrderQty || 1000;
    // pick a fabric + a trim item for the lines
    const shell = itemByName('Cotton') || fabricItem;
    const trim = itemByName('Woven Main Label');
    const proc = procs['sewing'];
    const mkLine = (it, cons, parts) => ({
      itemId: it.id, itemName: it.name || it.itemName, itemTypeId: it.itemTypeId, uom: it.uomName,
      partsName: parts, consumptionPerGarment: cons, consumptionMode: 'SIMPLE', consumptionMatrix: null,
      variantMapping: null, qtyCalcBasis: 'TOTAL', variantId: null,
      baseQty: orderQty, totalQty: r2(cons * orderQty), purchaseQty: r2(cons * orderQty * 1.05),
      processes: [{ id: proc.id, processName: proc.processName }],
      processAllowances: [{ processId: proc.id, processName: proc.processName, sortOrder: 0, shrinkageInches: 0, processLossPercent: 2, rejectionPercent: 2, shipmentAllowancePercent: 1 }],
      remarks: '',
    });
    const lines = [mkLine(shell, 0.25, ['Front Panel', 'Back Panel']), mkLine(trim, 1, ['Collar'])];
    const payload = {
      styleId: order.styleId, orderId: order.id, orderNo: order.orderNo, orderQty,
      status: bomIdx < 2 ? 'CREATED' : 'DRAFT', remarks: `BOM for ${order.orderNo}`, lines,
    };
    const res = await api('POST', '/boms', payload);
    if (!res.ok) { log.push(`bom ${ord.orderNo}: ${res.status} ${JSON.stringify(res.data)?.slice(0, 140)}`); continue; }
    out.boms.push({ id: res.data.id, orderNo: order.orderNo, status: res.data.status });
    bomIdx++;
  }
  console.log(`boms: ${out.boms.length} (${out.boms.filter((b) => b.status === 'CREATED').length} created)`);

  // ════════════════════════════ PURCHASE ORDERS (General) ════════════════
  console.log('── Purchase Orders ──');
  const computeLine = (it, qty, price, gst, isIgst) => {
    const base = qty * price, gstAmt = base * gst / 100, half = gst / 2;
    const l = { itemId: it.id, itemCode: it.itemCode, itemName: it.name || it.itemName, description: `${it.name || it.itemName} supply`, quantity: qty, uomId: it.uomId ?? null, uomName: it.uomName, unitPrice: price, hsnCode: it.hsnCode ?? null, categoryName: it.categoryName ?? null, variantId: null, variantAttributes: null, processingStages: null, bomLineSources: null, totalAmount: r2(base * (1 + gst / 100)), taxValue: r2(gstAmt) };
    if (isIgst) Object.assign(l, { igst: gst, cgst: null, sgst: null, igstValue: r2(gstAmt), cgstValue: null, sgstValue: null });
    else Object.assign(l, { cgst: half, sgst: half, igst: null, cgstValue: r2(base * half / 100), sgstValue: r2(base * half / 100), igstValue: null });
    return l;
  };
  const poSpecs = [
    { supplier: 'Arvind Limited', tnc: 'Standard Domestic PO', lines: [['Cotton Single Jersey 180 GSM', 1500, 280, 5], ['Cotton Pique 220 GSM', 800, 320, 5]], submit: true },
    { supplier: 'Premier Trims', tnc: 'Standard Domestic PO', lines: [['4-Hole Polyester Button 20L', 50, 60, 18], ['Woven Main Label', 5000, 1.2, 12], ['Nylon Zipper 7 inch', 2000, 18, 12]], submit: true },
    { supplier: 'Welspun India', tnc: 'Standard Export PO', lines: [['Polar Fleece 280 GSM', 1200, 360, 5]], submit: false },
    { supplier: 'Vardhman Textiles', tnc: 'Standard Domestic PO', lines: [['French Terry 260 GSM', 1000, 330, 5], ['Cotton Drawcord 8mm', 3000, 6, 12]], submit: false },
  ];
  let poIdx = 0;
  for (const po of poSpecs) {
    const sup = suppliers[po.supplier.toLowerCase()];
    const isIgst = !!sup.igstApplicable;
    const remarks = `Procurement PO for ${sup.name}`;
    if (poBySupplierRemark.has(`${sup.id}|${remarks}`)) { const e = existPos.find((p) => p.supplierId === sup.id && p.remarks === remarks); if (e) out.pos.push({ id: e.id, poNumber: e.poNumber, status: e.status, supplier: po.supplier }); continue; }
    const lineItems = po.lines.map(([n, qty, price, gst]) => computeLine(itemByName(n), qty, price, gst, isIgst));
    const subtotal = r2(lineItems.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
    const tax = r2(lineItems.reduce((a, l) => a + l.taxValue, 0));
    const payload = {
      poType: 'General', orderReferences: null, supplierId: sup.id, supplierName: sup.name,
      poDate: today(), deliveryDate: future(30 + poIdx * 5),
      termsConditionsId: tncs[po.tnc.toLowerCase()]?.id ?? null, termsConditionsTitle: po.tnc,
      remarks, status: po.submit ? 'Pending_Approval' : 'Draft',
      subtotal, tax, sgstValue: isIgst ? null : r2(lineItems.reduce((a, l) => a + (l.sgstValue || 0), 0)),
      cgstValue: isIgst ? null : r2(lineItems.reduce((a, l) => a + (l.cgstValue || 0), 0)),
      igstValue: isIgst ? r2(lineItems.reduce((a, l) => a + (l.igstValue || 0), 0)) : null,
      grandTotal: r2(subtotal + tax), lineItems,
    };
    const res = await api('POST', '/purchase-orders', payload);
    if (!res.ok) { log.push(`po ${po.supplier}: ${res.status} ${JSON.stringify(res.data)?.slice(0, 140)}`); continue; }
    out.pos.push({ id: res.data.id, poNumber: res.data.poNumber, status: res.data.status, supplier: po.supplier });
    poIdx++;
  }
  console.log(`purchase orders: ${out.pos.length}`);

  console.log('\n══════════ SUMMARY ══════════');
  console.log(`cost sheets: ${out.costSheets.length} | orders: ${out.orders.length} | boms: ${out.boms.length} | purchase orders: ${out.pos.length}`);
  if (log.length) console.log('\nISSUES:\n' + log.join('\n'));
  console.log('\nDETAIL ' + JSON.stringify(out));
}

main().catch((e) => { console.error('TXN SEED FAILED:', e.message, e.stack); process.exit(1); });
