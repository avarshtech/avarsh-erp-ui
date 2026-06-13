/**
 * Dev DB seeder — realistic, field-complete garment-manufacturing test data.
 *
 * Drives the REAL API (so validation + all computed fields are correct) against
 * the backend on :8088 (run it on the `dev` profile → Neon Postgres).
 *
 * Idempotent: every master is "ensured" by name, so re-runs reuse existing rows
 * instead of duplicating. Run:  node scripts/seed-dev.mjs
 */

const BASE = process.env.SEED_API || 'http://localhost:8088/api/v1';
const USER = process.env.SEED_USER || 'superadmin';
const PASS = process.env.SEED_PASS || 'admin123';

let TOKEN = '';
const today = () => new Date().toISOString().split('T')[0];
const future = (days) => new Date(Date.now() + days * 864e5).toISOString().split('T')[0];
const r2 = (n) => Math.round(n * 100) / 100;

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

const listOf = (d) => (Array.isArray(d) ? d : d?.content || []);
let created = 0; let reused = 0; const failures = [];

/** Ensure a master row exists by a name field; returns its id. */
async function ensure(label, listPath, createPath, nameField, nameValue, payload) {
  try {
    const list = listOf((await api('GET', listPath)).data);
    const hit = list.find((x) => String(x[nameField] ?? x.name ?? x.processName ?? x.overheadName ?? x.attributeName ?? x.styleNo)
      ?.toLowerCase() === String(nameValue).toLowerCase());
    if (hit) { reused++; return hit.id; }
    const res = await api('POST', createPath, payload);
    if (!res.ok || !res.data?.id) { failures.push(`${label} "${nameValue}": ${res.status} ${JSON.stringify(res.data)?.slice(0, 160)}`); return null; }
    created++;
    return res.data.id;
  } catch (e) { failures.push(`${label} "${nameValue}": ${e.message}`); return null; }
}

async function login() {
  const res = await api('POST', '/auth/login', { username: USER, password: PASS });
  if (!res.data?.token) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.data)}`);
  TOKEN = res.data.token;
  console.log(`✓ logged in as ${USER}`);
}

async function main() {
  await login();
  const reg = {}; // registry of created ids

  // ──────────────────────────────── UOMs ────────────────────────────────
  console.log('\n── UOMs ──');
  const uoms = [
    ['Meters', 'MTR', 2], ['Kilograms', 'KG', 3], ['Pieces', 'PCS', 0], ['Gross', 'GRS', 0],
    ['Dozen', 'DZN', 0], ['Yards', 'YDS', 2], ['Centimeters', 'CM', 2], ['Cone', 'CON', 0],
    ['Roll', 'ROL', 0], ['Set', 'SET', 0], ['Inch', 'IN', 2],
  ];
  reg.uom = {};
  for (const [name, symbol, dp] of uoms) {
    reg.uom[symbol] = await ensure('UOM', '/unit-of-measures', '/unit-of-measures', 'name', name,
      { name, symbol, decimalPrecision: dp });
  }

  // ──────────────────────────── Attribute configs ───────────────────────
  console.log('── Attributes ──');
  reg.attr = {};
  for (const [attributeName, dataType] of [['Color', 'Text'], ['Size', 'Text'], ['GSM', 'Number'], ['Width', 'Text'], ['Composition', 'Text']]) {
    reg.attr[attributeName] = await ensure('Attribute', '/attribute-configs', '/attribute-configs', 'attributeName', attributeName,
      { attributeName, dataType });
  }

  // ──────────────────────── Categories → SubCategories → ItemTypes ───────
  console.log('── Catalog cascade ──');
  reg.cat = {}; reg.sub = {}; reg.type = {};
  const catalog = {
    Fabric: {
      Knit: ['Single Jersey', 'Pique', 'Interlock', 'Rib', 'Fleece', 'French Terry'],
      Woven: ['Poplin', 'Twill', 'Oxford', 'Canvas'],
      Denim: ['Denim Fabric'],
    },
    Trims: {
      Button: ['Polyester Button', 'Metal Button', 'Snap Button'],
      Zipper: ['Nylon Zipper', 'Metal Zipper'],
      Label: ['Woven Label', 'Printed Label'],
      'Sewing Thread': ['Spun Polyester Thread'],
      Elastic: ['Knitted Elastic'],
      Drawcord: ['Cotton Drawcord'],
    },
    Accessories: { Hangtag: ['Cardboard Hangtag'], Polybag: ['LDPE Polybag'], Sticker: ['Size Sticker'] },
    'Packing Material': { Carton: ['Corrugated Carton'], Tape: ['BOPP Tape'] },
  };
  for (const [catName, subs] of Object.entries(catalog)) {
    const catId = await ensure('Category', '/categories', '/categories', 'name', catName, { name: catName, description: `${catName} master category` });
    reg.cat[catName] = catId;
    const isFabric = catName.toLowerCase().includes('fabric');
    for (const [subName, types] of Object.entries(subs)) {
      const subId = await ensure('SubCategory', '/sub-categories', '/sub-categories', 'name', subName, { categoryId: catId, name: subName, description: `${subName} (${catName})` });
      reg.sub[subName] = subId;
      // Fabric types carry Color + GSM + Width attrs and KG/MTR uoms; trims carry Color + Size.
      const attributeIds = isFabric ? [reg.attr.Color, reg.attr.GSM, reg.attr.Width].filter(Boolean) : [reg.attr.Color, reg.attr.Size].filter(Boolean);
      const uomIds = isFabric ? [reg.uom.KG, reg.uom.MTR].filter(Boolean)
        : [reg.uom.PCS, reg.uom.GRS, reg.uom.CON, reg.uom.MTR].filter(Boolean);
      for (const typeName of types) {
        reg.type[typeName] = await ensure('ItemType', '/item-types', '/item-types', 'name', typeName,
          { name: typeName, subCategoryId: subId, attributeIds, uomIds });
      }
    }
  }

  // ──────────────────────────────── Items (+variants) ────────────────────
  console.log('── Items ──');
  reg.item = {};
  const COLORS = ['White', 'Black', 'Navy', 'Grey Melange', 'Red'];
  const mkVariants = (name, attrKey, values) => values.map((v) => ({ itemName: name, isActive: true, attributes: { [attrKey]: v } }));

  const fabricItems = [
    ['Cotton Single Jersey 180 GSM', 'Single Jersey', 'Knit', '6006'],
    ['Cotton Pique 220 GSM', 'Pique', 'Knit', '6006'],
    ['Cotton Interlock 200 GSM', 'Interlock', 'Knit', '6006'],
    ['Polar Fleece 280 GSM', 'Fleece', 'Knit', '6001'],
    ['French Terry 260 GSM', 'French Terry', 'Knit', '6006'],
    ['Poly Cotton Twill 240 GSM', 'Twill', 'Woven', '5209'],
    ['Cotton Poplin 120 GSM', 'Poplin', 'Woven', '5208'],
    ['Denim 12oz', 'Denim Fabric', 'Denim', '5209'],
  ];
  for (const [name, typeName, subName, hsn] of fabricItems) {
    reg.item[name] = await ensure('Item', '/items/search', '/items', 'itemName', name, {
      itemName: name, categoryId: reg.cat.Fabric, subCategoryId: reg.sub[subName], itemTypeId: reg.type[typeName],
      uomId: reg.uom.KG, secondaryUomId: reg.uom.MTR, hsnCode: hsn, defaultAllowance: 5, isActive: true,
      variants: mkVariants(name, 'color', COLORS),
    });
  }
  const trimItems = [
    ['4-Hole Polyester Button 20L', 'Polyester Button', 'Button', 'GRS', '9606', ['White', 'Black', 'Navy']],
    ['Metal Snap Button 15mm', 'Snap Button', 'Button', 'GRS', '9606', ['Silver', 'Antique Brass']],
    ['Nylon Zipper 7 inch', 'Nylon Zipper', 'Zipper', 'PCS', '9607', ['Black', 'Navy', 'White']],
    ['Metal Zipper 5 inch', 'Metal Zipper', 'Zipper', 'PCS', '9607', ['Antique Brass', 'Silver']],
    ['Woven Main Label', 'Woven Label', 'Label', 'PCS', '5807', ['Standard']],
    ['Printed Care Label', 'Printed Label', 'Label', 'PCS', '5807', ['Standard']],
    ['Spun Polyester Sewing Thread 40s', 'Spun Polyester Thread', 'Sewing Thread', 'CON', '5508', COLORS],
    ['Knitted Elastic 1 inch', 'Knitted Elastic', 'Elastic', 'MTR', '5604', ['White', 'Black']],
    ['Cotton Drawcord 8mm', 'Cotton Drawcord', 'Drawcord', 'MTR', '5607', ['White', 'Black', 'Navy']],
    ['Cardboard Hangtag', 'Cardboard Hangtag', 'Hangtag', 'PCS', '4821', ['Standard']],
    ['LDPE Polybag 12x15', 'LDPE Polybag', 'Polybag', 'PCS', '3923', ['Transparent']],
  ];
  for (const [name, typeName, subName, uomSym, hsn, colors] of trimItems) {
    reg.item[name] = await ensure('Item', '/items/search', '/items', 'itemName', name, {
      itemName: name, categoryId: subName === 'Hangtag' || subName === 'Polybag' || subName === 'Sticker' ? reg.cat.Accessories : reg.cat.Trims,
      subCategoryId: reg.sub[subName], itemTypeId: reg.type[typeName],
      uomId: reg.uom[uomSym], hsnCode: hsn, defaultAllowance: 3, isActive: true,
      variants: mkVariants(name, 'color', colors),
    });
  }

  // ──────────────────────────────── Processes ────────────────────────────
  console.log('── Processes ──');
  reg.process = {};
  const costProcs = [
    ['Cutting', 'Cutting', 8], ['Sewing', 'Sewing', 25], ['Washing', 'Washing', 18],
    ['Printing', 'Printing', 12], ['Embroidery', 'Embroidery', 15], ['Finishing', 'Finishing', 5],
    ['Ironing & Packing', 'Ironing/Packing', 6], ['Garment Dyeing', 'Garment Dyeing', 20],
  ];
  for (const [processName, category, cost] of costProcs) {
    reg.process[processName] = await ensure('Process', '/processes', '/processes', 'processName', processName, {
      processName, description: `${processName} operation`, category, defaultCost: cost,
      defaultShrinkageInches: 0, defaultProcessLossPercent: 0, defaultRejectionPercent: 0, defaultShipmentAllowancePercent: 0, isActive: true,
    });
  }
  const allowanceProcs = [
    ['Fabric Dyeing', 'Dyeing', 1.5, 3, 2, 2], ['Compacting', 'Finishing', 2.0, 1, 1.5, 1], ['Bio Wash', 'Washing', 1.0, 2, 2, 1.5],
  ];
  for (const [processName, category, shrink, loss, rej, ship] of allowanceProcs) {
    reg.process[processName] = await ensure('Process', '/processes', '/processes', 'processName', processName, {
      processName, description: `${processName} (allowance)`, category, defaultCost: 0,
      defaultShrinkageInches: shrink, defaultProcessLossPercent: loss, defaultRejectionPercent: rej, defaultShipmentAllowancePercent: ship, isActive: true,
    });
  }

  // ──────────────────────────────── Parts ────────────────────────────────
  console.log('── Parts ──');
  reg.part = {};
  for (const p of ['Front Panel', 'Back Panel', 'Sleeve', 'Collar', 'Cuff', 'Pocket', 'Hood', 'Waistband', 'Placket', 'Yoke', 'Rib']) {
    reg.part[p] = await ensure('Part', '/parts', '/parts', 'partName', p, { partName: p, description: `${p} component`, isActive: true });
  }

  // ──────────────────────────────── Overheads ────────────────────────────
  console.log('── Overheads ──');
  reg.overhead = {};
  const overheads = [
    ['Testing & Inspection', 'Testing Charges', 15], ['Sampling Cost', 'Sampling', 50], ['Freight (Domestic)', 'Transport', 25],
    ['Freight (Export)', 'Transport', 120], ['Bank Charges', 'Bank Charges', 18], ['Documentation', 'Documentation', 10],
  ];
  for (const [overheadName, category, cost] of overheads) {
    reg.overhead[overheadName] = await ensure('Overhead', '/overheads', '/overheads', 'overheadName', overheadName,
      { overheadName, description: `${overheadName} overhead`, category, defaultCost: cost, isActive: true });
  }

  // ──────────────────────────────── Size presets ─────────────────────────
  console.log('── Size presets ──');
  reg.preset = {};
  const presets = [
    ['Adult Alpha (XS-XXL)', 'Adult', 'Global', ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
    ['Adult Numeric (28-40)', 'Adult', 'US', ['28', '30', '32', '34', '36', '38', '40']],
    ['Kids (2-14)', 'Children', 'EU', ['2', '4', '6', '8', '10', '12', '14']],
    ['Alpha Extended (XS-4XL)', 'Adult', 'Global', ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']],
  ];
  for (const [name, category, region, sizes] of presets) {
    reg.preset[name] = await ensure('SizePreset', '/size-presets', '/size-presets', 'name', name, { name, category, region, sizes, active: true });
  }

  // ──────────────────────────────── Payment terms ────────────────────────
  console.log('── Payment terms ──');
  reg.pterm = {};
  const pterms = [
    ['LC at Sight', 0, 0], ['LC 30 Days', 30, 0], ['LC 60 Days', 60, 0], ['LC 90 Days', 90, 0],
    ['TT Advance 30%', 0, 30], ['Net 30', 30, 0],
  ];
  for (const [name, days, adv] of pterms) {
    reg.pterm[name] = await ensure('PaymentTerm', '/payment-terms', '/payment-terms', 'name', name,
      { name, description: `${name} payment term`, paymentDays: days, advancePercentage: adv, active: true });
  }

  // ──────────────────────────────── Terms & Conditions ───────────────────
  console.log('── Terms & Conditions ──');
  reg.tnc = {};
  for (const [name, body] of [
    ['Standard Domestic PO', '<p>Goods to be delivered as per agreed schedule. Payment within agreed credit period. GST extra as applicable.</p>'],
    ['Standard Export PO', '<p>Shipment as per Incoterms. Inspection before dispatch. LC terms apply. Quality as per approved samples.</p>'],
  ]) {
    reg.tnc[name] = await ensure('T&C', '/terms-conditions', '/terms-conditions', 'name', name, { name, description: body });
  }

  // ──────────────────────────────── Buyers (+shipping) ───────────────────
  console.log('── Buyers ──');
  reg.buyer = {};
  const buyers = [
    ['H&M Hennes & Mauritz', 'orders@hm.com', '+46851159000', 'Anna Lindberg', [['Hamburg DC', 'Hamburg', 'Germany'], ['Stockholm HQ', 'Stockholm', 'Sweden']]],
    ['Zara (Inditex)', 'sourcing@inditex.com', '+34981185400', 'Pablo Garcia', [['Arteixo DC', 'A Coruña', 'Spain']]],
    ['Next PLC', 'buying@next.co.uk', '+441628565000', 'James Carter', [['Leicester DC', 'Leicester', 'United Kingdom']]],
    ['Primark', 'supply@primark.com', '+35312367000', 'Siobhan Murphy', [['Dublin DC', 'Dublin', 'Ireland']]],
    ['GAP Inc', 'vendor@gap.com', '+14154270100', 'Michael Brown', [['Gallup DC', 'New Mexico', 'USA']]],
    ['Uniqlo (Fast Retailing)', 'global@uniqlo.com', '+81337569000', 'Kenji Tanaka', [['Ariake DC', 'Tokyo', 'Japan']]],
  ];
  for (const [name, email, phone, contact, locs] of buyers) {
    reg.buyer[name] = await ensure('Buyer', '/buyers', '/buyers', 'name', name, {
      name, email, phone, contactPerson: contact, active: true,
      shippingLocations: locs.map(([label, city, country], i) => ({
        label, address: `${i + 1} ${city} Distribution Centre`, city, state: city, country, postalCode: '00000', active: true,
      })),
    });
  }

  // ──────────────────────────────── Suppliers ────────────────────────────
  console.log('── Suppliers ──');
  reg.supplier = {};
  const suppliers = [
    ['Arvind Limited', 'sales@arvind.com', 'Ahmedabad', 'Gujarat', '24', '24AACCA1234M1Z5', 'AACCA1234M', false, true, false],
    ['Vardhman Textiles', 'sales@vardhman.com', 'Ludhiana', 'Punjab', '03', '03AABCV1234N1Z6', 'AABCV1234N', false, true, false],
    ['Shahi Exports', 'trims@shahi.co.in', 'Bengaluru', 'Karnataka', '29', '29AAACS1234P1Z7', 'AAACS1234P', false, false, true],
    ['Gokaldas Exports', 'info@gokaldas.com', 'Bengaluru', 'Karnataka', '29', '29AAACG1234Q1Z8', 'AAACG1234Q', false, true, true],
    ['Premier Trims', 'sales@premiertrims.in', 'Tirupur', 'Tamil Nadu', '33', '33AAFCP1234R1Z9', 'AAFCP1234R', false, false, true],
    ['Welspun India', 'export@welspun.com', 'Mumbai', 'Maharashtra', '27', '27AAACW1234S1Z1', 'AAACW1234S', true, true, false],
  ];
  for (const [name, email, city, state, stateCode, gstin, pan, igst, fab, trim] of suppliers) {
    reg.supplier[name] = await ensure('Supplier', '/suppliers', '/suppliers', 'name', name, {
      name, email, phone: '+919876500000', contactPerson: 'Sales Head',
      address: `Industrial Area, ${city}`, city, state, stateCode, country: 'India', pincode: '000000',
      gstin, pan, igstApplicable: igst, suppliesFabric: fab, suppliesTrims: trim,
      bankName: 'HDFC Bank', bankAccountNumber: '50100' + Math.floor(Math.random ? 0 : 0) + name.length + '001',
      bankBranch: city, ifscCode: 'HDFC0001234', active: true,
    });
  }

  // ──────────────────────────────── Defect types & Trims QC ──────────────
  console.log('── Defect types & Trims QC ──');
  reg.defect = {};
  for (const [name, desc] of [
    ['Broken Stitch', 'Stitch broken along the seam line'], ['Open Seam', 'Seam not closed / split'],
    ['Stain', 'Oil / dirt / water stain on garment'], ['Hole', 'Fabric hole or needle damage'],
    ['Color Variation', 'Shade mismatch across panels'], ['Measurement Defect', 'Out of tolerance measurement'],
    ['Skip Stitch', 'Missed stitches in seam'], ['Puckering', 'Seam puckering / wavy seam'],
  ]) reg.defect[name] = await ensure('DefectType', '/defect-types', '/defect-types', 'name', name, { name, description: desc, active: true });

  reg.qc = {};
  for (const [name, desc] of [
    ['Button Pull Strength', 'Button must withstand 90N pull force'], ['Zipper Functionality', 'Zipper slides smoothly, locks in place'],
    ['Label Placement', 'Main/care labels at correct position'], ['Snap Engagement', 'Snap button engages and releases cleanly'],
    ['Care Label Accuracy', 'Care symbols match the approved care label'],
  ]) reg.qc[name] = await ensure('TrimsQC', '/trims-qc-criteria', '/trims-qc-criteria', 'name', name, { name, description: desc, active: true });

  // ──────────────────────────────── Styles ───────────────────────────────
  console.log('── Styles ──');
  reg.style = {};
  const styles = [
    ['AV-SS26-POLO', 'Classic Pique Polo Shirt', 'H&M Hennes & Mauritz', 'SS', '2026'],
    ['AV-AW25-HOOD', 'Fleece Pullover Hoodie', 'Zara (Inditex)', 'AW', '2025'],
    ['AV-AW26-JOG', 'French Terry Jogger Pants', 'Next PLC', 'AW', '2026'],
    ['AV-SS26-TEE', 'Crew Neck Cotton Tee', 'Primark', 'SS', '2026'],
    ['AV-SS26-SHIRT', 'Oxford Casual Shirt', 'GAP Inc', 'SS', '2026'],
    ['AV-AW26-SWEAT', 'Crew Neck Sweatshirt', 'Uniqlo (Fast Retailing)', 'AW', '2026'],
  ];
  for (const [styleNo, garmentName, buyerName, sc, sy] of styles) {
    reg.style[styleNo] = await ensure('Style', '/styles', '/styles', 'styleNo', styleNo, {
      styleNo, garmentName, buyerId: reg.buyer[buyerName], seasonCode: sc, seasonYear: sy,
      description: `${garmentName} for ${buyerName}`, isActive: true,
    });
  }

  console.log(`\n✓ Masters done. created=${created} reused=${reused} failures=${failures.length}`);
  if (failures.length) { console.log('FAILURES:\n' + failures.slice(0, 30).join('\n')); }

  // expose registry for the transactional phase
  globalThis.__reg = reg;
  return reg;
}

main().then((reg) => {
  console.log('\nMASTER_REGISTRY ' + JSON.stringify({
    uom: reg.uom, cat: reg.cat, sub: reg.sub, type: reg.type,
    item: reg.item, process: reg.process, part: reg.part, overhead: reg.overhead,
    preset: reg.preset, pterm: reg.pterm, tnc: reg.tnc, buyer: reg.buyer,
    supplier: reg.supplier, style: reg.style, attr: reg.attr,
  }));
}).catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
