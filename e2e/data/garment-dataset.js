/**
 * Canonical Garment Manufacturing Dataset
 *
 * The single source of truth for every UI-driven journey spec. Names are FIXED (no
 * timestamps) so specs are idempotent: each helper searches for the record first and
 * skips creation when it already exists. That keeps re-runs safe and leaves the
 * database looking like a real garment export house rather than a pile of test junk.
 *
 * Load-bearing names — do not rename without checking the consumer:
 *   - Categories 'Fabric' / 'Local Trims' / 'Imported Trims' are matched by exact name
 *     in CostingForm.jsx, and passed verbatim to GET /variants/search?category=.
 *   - Category 'Fabric' also drives the "secondary UOM required" rule in ItemMaster.jsx.
 *
 * Item identity note: the backend allows exactly ONE item per
 * Category + Sub-Category + Item Type. The item name is derived from that triple, so
 * all real differentiation (colour, GSM, size, ligne) lives on the variants.
 */

// ── Unit of Measure ────────────────────────────────────────────────
export const UOMS = [
  { name: 'Meter', symbol: 'MTR' },
  { name: 'Yard', symbol: 'YDS' },
  { name: 'Kilogram', symbol: 'KG' },
  { name: 'Piece', symbol: 'PCS' },
  { name: 'Gross', symbol: 'GRS' },
  { name: 'Cone', symbol: 'CON' },
  { name: 'Dozen', symbol: 'DZN' },
];

/**
 * Symbol → name lookup.
 *
 * The screens are inconsistent about which one they show: the Item Types form lists
 * UOMs by `name` ("Kilogram"), while the Item form lists them by `symbol` ("KG").
 * Specs pick the right label with this map rather than hard-coding either.
 */
export const UOM_NAME_BY_SYMBOL = Object.fromEntries(UOMS.map((u) => [u.symbol, u.name]));

// ── Attribute configs (drive variant attributes + generated variant codes) ──
export const ATTRIBUTES = [
  { name: 'Color', dataType: 'string' },
  { name: 'GSM', dataType: 'number' },
  { name: 'Width', dataType: 'number' },
  { name: 'Size', dataType: 'string' },
  { name: 'Ligne', dataType: 'number' },
  { name: 'Yarn Count', dataType: 'string' },
  { name: 'Composition', dataType: 'string' },
];

// ── Categories ─────────────────────────────────────────────────────
export const CATEGORIES = [
  { name: 'Fabric', description: 'Knitted, woven and denim fabrics' },
  { name: 'Local Trims', description: 'Domestically sourced trims and accessories' },
  { name: 'Imported Trims', description: 'Imported zippers, elastics and interlinings' },
  { name: 'Packing Materials', description: 'Cartons, polybags and packing consumables' },
];

// ── Sub-Categories ─────────────────────────────────────────────────
export const SUB_CATEGORIES = [
  { name: 'Knits', category: 'Fabric' },
  { name: 'Woven', category: 'Fabric' },
  { name: 'Denim', category: 'Fabric' },
  { name: 'Sewing Threads', category: 'Local Trims' },
  { name: 'Buttons & Fasteners', category: 'Local Trims' },
  { name: 'Labels & Tags', category: 'Local Trims' },
  { name: 'Zippers', category: 'Imported Trims' },
  { name: 'Elastics & Tapes', category: 'Imported Trims' },
  { name: 'Interlining', category: 'Imported Trims' },
  { name: 'Cartons & Polybags', category: 'Packing Materials' },
];

/**
 * Item Types. `attributes` are the attribute-config names attached to the type;
 * every variant of the resulting item must supply a value for each.
 * `uoms` restricts the UOM dropdown on the item form.
 */
export const ITEM_TYPES = [
  // Fabric / Knits
  { name: 'Single Jersey', subCategory: 'Knits', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  { name: 'Pique', subCategory: 'Knits', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  { name: 'Rib 1x1', subCategory: 'Knits', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  { name: 'Fleece', subCategory: 'Knits', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  // Fabric / Woven
  { name: 'Poplin', subCategory: 'Woven', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  { name: 'Twill', subCategory: 'Woven', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  // Fabric / Denim
  { name: 'Denim 3x1 RHT', subCategory: 'Denim', attributes: ['Color', 'GSM', 'Width'], uoms: ['KG', 'MTR'] },
  // Local Trims
  { name: 'Spun Polyester Thread', subCategory: 'Sewing Threads', attributes: ['Color', 'Yarn Count'], uoms: ['CON', 'MTR'] },
  { name: '4-Hole Polyester Button', subCategory: 'Buttons & Fasteners', attributes: ['Color', 'Ligne'], uoms: ['GRS', 'PCS'] },
  { name: 'Metal Snap Button', subCategory: 'Buttons & Fasteners', attributes: ['Color', 'Ligne'], uoms: ['GRS', 'PCS'] },
  { name: 'Woven Main Label', subCategory: 'Labels & Tags', attributes: ['Color', 'Size'], uoms: ['PCS'] },
  { name: 'Care Label', subCategory: 'Labels & Tags', attributes: ['Color', 'Size'], uoms: ['PCS'] },
  { name: 'Hang Tag', subCategory: 'Labels & Tags', attributes: ['Color', 'Size'], uoms: ['PCS'] },
  // Imported Trims
  { name: 'Nylon Coil Zipper', subCategory: 'Zippers', attributes: ['Color', 'Size'], uoms: ['PCS'] },
  { name: 'Metal Zipper', subCategory: 'Zippers', attributes: ['Color', 'Size'], uoms: ['PCS'] },
  { name: 'Knitted Elastic', subCategory: 'Elastics & Tapes', attributes: ['Color', 'Width'], uoms: ['MTR'] },
  { name: 'Fusible Interlining', subCategory: 'Interlining', attributes: ['Color', 'GSM'], uoms: ['MTR'] },
  // Packing
  { name: 'Export Carton', subCategory: 'Cartons & Polybags', attributes: ['Size'], uoms: ['PCS'] },
  { name: 'Polybag', subCategory: 'Cartons & Polybags', attributes: ['Size'], uoms: ['PCS'] },
];

/**
 * Items — one per Category / Sub-Category / Item Type triple.
 *
 * `uom` is the primary (purchase) UOM, `secondaryUom` the consumption UOM.
 * `conversionFactor` answers "how many secondary UOM make one primary UOM" and is
 * REQUIRED by the server whenever secondaryUom differs from uom.
 */
export const ITEMS = [
  {
    category: 'Fabric', subCategory: 'Knits', itemType: 'Single Jersey',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 3.2,
    hsnCode: '60062200', allowance: 3, description: '100% Combed Cotton Single Jersey',
    variants: [
      { name: 'Single Jersey 180 GSM Navy Blue', attrs: { Color: 'Navy Blue', GSM: 180, Width: 68 } },
      { name: 'Single Jersey 180 GSM White', attrs: { Color: 'White', GSM: 180, Width: 68 } },
      { name: 'Single Jersey 160 GSM Black', attrs: { Color: 'Black', GSM: 160, Width: 66 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Knits', itemType: 'Pique',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 2.8,
    hsnCode: '60062200', allowance: 3, description: '100% Cotton Pique Knit',
    variants: [
      { name: 'Pique 220 GSM Royal Blue', attrs: { Color: 'Royal Blue', GSM: 220, Width: 66 } },
      { name: 'Pique 220 GSM White', attrs: { Color: 'White', GSM: 220, Width: 66 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Knits', itemType: 'Rib 1x1',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 2.4,
    hsnCode: '60062200', allowance: 3, description: '1x1 Rib for collar and cuff',
    variants: [
      { name: 'Rib 1x1 240 GSM Navy Blue', attrs: { Color: 'Navy Blue', GSM: 240, Width: 32 } },
      { name: 'Rib 1x1 240 GSM White', attrs: { Color: 'White', GSM: 240, Width: 32 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Knits', itemType: 'Fleece',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 1.9,
    hsnCode: '60011000', allowance: 4, description: 'Brushed Back Fleece',
    variants: [
      { name: 'Fleece 280 GSM Charcoal Grey', attrs: { Color: 'Charcoal Grey', GSM: 280, Width: 70 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Woven', itemType: 'Poplin',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 6.5,
    hsnCode: '52081200', allowance: 3, description: '100% Cotton Poplin 40s x 40s',
    variants: [
      { name: 'Poplin 120 GSM Sky Blue', attrs: { Color: 'Sky Blue', GSM: 120, Width: 58 } },
      { name: 'Poplin 120 GSM White', attrs: { Color: 'White', GSM: 120, Width: 58 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Woven', itemType: 'Twill',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 4.2,
    hsnCode: '52094200', allowance: 3, description: 'Cotton Twill 2x1',
    variants: [
      { name: 'Twill 210 GSM Khaki Beige', attrs: { Color: 'Khaki Beige', GSM: 210, Width: 58 } },
    ],
  },
  {
    category: 'Fabric', subCategory: 'Denim', itemType: 'Denim 3x1 RHT',
    uom: 'KG', secondaryUom: 'MTR', conversionFactor: 2.1,
    hsnCode: '52094200', allowance: 4, description: '98% Cotton 2% Elastane Denim',
    variants: [
      { name: 'Denim 12 Oz Indigo Blue', attrs: { Color: 'Indigo Blue', GSM: 400, Width: 58 } },
      { name: 'Denim 10 Oz Light Indigo', attrs: { Color: 'Light Indigo', GSM: 340, Width: 58 } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Sewing Threads', itemType: 'Spun Polyester Thread',
    uom: 'CON', secondaryUom: 'MTR', conversionFactor: 5000,
    hsnCode: '54011000', allowance: 5, description: '100% Spun Polyester Sewing Thread',
    variants: [
      { name: 'Sewing Thread 40s2 Navy Blue', attrs: { Color: 'Navy Blue', 'Yarn Count': '40s/2' } },
      { name: 'Sewing Thread 40s2 White', attrs: { Color: 'White', 'Yarn Count': '40s/2' } },
      { name: 'Sewing Thread 60s3 Black', attrs: { Color: 'Black', 'Yarn Count': '60s/3' } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Buttons & Fasteners', itemType: '4-Hole Polyester Button',
    uom: 'GRS', secondaryUom: 'PCS', conversionFactor: 144,
    hsnCode: '96062100', allowance: 5, description: '4-Hole Polyester Shirt Button',
    variants: [
      { name: '4-Hole Button 18L White', attrs: { Color: 'White', Ligne: 18 } },
      { name: '4-Hole Button 18L Navy Blue', attrs: { Color: 'Navy Blue', Ligne: 18 } },
      { name: '4-Hole Button 24L Black', attrs: { Color: 'Black', Ligne: 24 } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Buttons & Fasteners', itemType: 'Metal Snap Button',
    uom: 'GRS', secondaryUom: 'PCS', conversionFactor: 144,
    hsnCode: '96062900', allowance: 5, description: 'Antique Brass Metal Snap Button',
    variants: [
      { name: 'Metal Snap Button 20L Antique Brass', attrs: { Color: 'Antique Brass', Ligne: 20 } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Labels & Tags', itemType: 'Woven Main Label',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '58071010', allowance: 2, description: 'Damask Woven Main Label',
    variants: [
      { name: 'Woven Main Label Medium White', attrs: { Color: 'White', Size: 'M' } },
      { name: 'Woven Main Label Large White', attrs: { Color: 'White', Size: 'L' } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Labels & Tags', itemType: 'Care Label',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '58071010', allowance: 2, description: 'Satin Printed Care Label',
    variants: [
      { name: 'Care Label Standard White', attrs: { Color: 'White', Size: 'M' } },
    ],
  },
  {
    category: 'Local Trims', subCategory: 'Labels & Tags', itemType: 'Hang Tag',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '48211010', allowance: 2, description: '300 GSM Art Card Hang Tag',
    variants: [
      { name: 'Hang Tag Recycled Kraft Brown', attrs: { Color: 'Kraft Brown', Size: 'M' } },
    ],
  },
  {
    category: 'Imported Trims', subCategory: 'Zippers', itemType: 'Nylon Coil Zipper',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '96071110', allowance: 3, description: 'YKK #3 Nylon Coil Closed End Zipper',
    variants: [
      { name: 'Nylon Coil Zipper No3 Black 18cm', attrs: { Color: 'Black', Size: '18 cm' } },
      { name: 'Nylon Coil Zipper No3 Navy 20cm', attrs: { Color: 'Navy Blue', Size: '20 cm' } },
    ],
  },
  {
    category: 'Imported Trims', subCategory: 'Zippers', itemType: 'Metal Zipper',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '96071190', allowance: 3, description: 'YKK #5 Brass Metal Open End Zipper',
    variants: [
      { name: 'Metal Zipper No5 Antique Brass 16cm', attrs: { Color: 'Antique Brass', Size: '16 cm' } },
    ],
  },
  {
    category: 'Imported Trims', subCategory: 'Elastics & Tapes', itemType: 'Knitted Elastic',
    uom: 'MTR', secondaryUom: null, conversionFactor: null,
    hsnCode: '58061000', allowance: 4, description: 'Knitted Waistband Elastic',
    variants: [
      { name: 'Knitted Elastic 30mm White', attrs: { Color: 'White', Width: 30 } },
      { name: 'Knitted Elastic 40mm Black', attrs: { Color: 'Black', Width: 40 } },
    ],
  },
  {
    category: 'Imported Trims', subCategory: 'Interlining', itemType: 'Fusible Interlining',
    uom: 'MTR', secondaryUom: null, conversionFactor: null,
    hsnCode: '59039090', allowance: 4, description: 'Woven Fusible Interlining',
    variants: [
      { name: 'Fusible Interlining 50 GSM White', attrs: { Color: 'White', GSM: 50 } },
    ],
  },
  {
    category: 'Packing Materials', subCategory: 'Cartons & Polybags', itemType: 'Export Carton',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '48191010', allowance: 2, description: '5-Ply Corrugated Export Carton',
    variants: [
      { name: 'Export Carton 5-Ply Standard', attrs: { Size: 'L' } },
    ],
  },
  {
    category: 'Packing Materials', subCategory: 'Cartons & Polybags', itemType: 'Polybag',
    uom: 'PCS', secondaryUom: null, conversionFactor: null,
    hsnCode: '39232100', allowance: 2, description: 'LDPE Self-Adhesive Polybag',
    variants: [
      { name: 'Polybag LDPE Medium Clear', attrs: { Size: 'M' } },
    ],
  },
];

// ── Business partners ──────────────────────────────────────────────
export const BUYERS = [
  {
    name: 'H&M Hennes & Mauritz AB',
    code: 'HM',
    country: 'Sweden',
    currency: 'USD',
    email: 'sourcing@hm-buying.example.com',
    phone: '+46812345678',
    address: 'Master Samuelsgatan 46A, Stockholm 106 38',
  },
  {
    name: 'Primark Stores Ltd',
    code: 'PRIMARK',
    country: 'United Kingdom',
    currency: 'GBP',
    email: 'orders@primark-buying.example.com',
    phone: '+442071234567',
    address: '22-24 Parnell Street, Dublin 1',
  },
];

export const SUPPLIERS = [
  {
    name: 'Arvind Mills Ltd',
    code: 'ARVIND',
    supplies: 'Fabric',
    gstin: '24AABCA1234M1Z5',
    state: 'Gujarat',
    email: 'sales@arvind-mills.example.com',
    phone: '+919876543210',
    address: 'Naroda Road, Ahmedabad, Gujarat 380025',
  },
  {
    name: 'Coats India Pvt Ltd',
    code: 'COATS',
    supplies: 'Local Trims',
    gstin: '33AAACC5678N1Z2',
    state: 'Tamil Nadu',
    email: 'orders@coats-india.example.com',
    phone: '+919845012345',
    address: 'Ambattur Industrial Estate, Chennai, Tamil Nadu 600058',
  },
  {
    name: 'YKK India Pvt Ltd',
    code: 'YKK',
    supplies: 'Imported Trims',
    gstin: '06AAACY9012P1Z8',
    state: 'Haryana',
    email: 'export@ykk-india.example.com',
    phone: '+919812345678',
    address: 'Bawal Industrial Area, Rewari, Haryana 123501',
  },
];

// ── Style management ───────────────────────────────────────────────
export const SIZE_PRESETS = [
  { name: 'Tops S-XXL', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { name: 'Bottoms 28-38', sizes: ['28', '30', '32', '34', '36', '38'] },
];

export const STYLES = [
  {
    styleNo: 'HM-TS-2601',
    name: "Men's Crew Neck T-Shirt",
    buyer: 'H&M Hennes & Mauritz AB',
    sizePreset: 'Tops S-XXL',
    season: 'SS26',
    description: 'Short sleeve crew neck tee, single jersey, side seamed',
  },
  {
    styleNo: 'HM-PL-2602',
    name: "Ladies Pique Polo Shirt",
    buyer: 'H&M Hennes & Mauritz AB',
    sizePreset: 'Tops S-XXL',
    season: 'SS26',
    description: 'Short sleeve pique polo with rib collar and 3-button placket',
  },
  {
    styleNo: 'PRK-DN-2603',
    name: "Men's Slim Fit Denim Jeans",
    buyer: 'Primark Stores Ltd',
    sizePreset: 'Bottoms 28-38',
    season: 'AW26',
    description: '5-pocket slim fit jeans, 12 oz stretch denim',
  },
];

// ── Commercial ─────────────────────────────────────────────────────
export const PAYMENT_TERMS = [
  { name: 'TT 30 Days', days: 30, description: 'Telegraphic Transfer, 30 days from B/L date' },
  { name: 'LC at Sight 60 Days', days: 60, description: 'Irrevocable Letter of Credit at sight, 60 days usance' },
];

export const TERMS_CONDITIONS = [
  {
    title: 'Standard Purchase Terms',
    content: 'Goods must match the approved sample. Rejected material is returnable at supplier cost within 15 days of GRN.',
  },
  {
    title: 'Fabric Delivery Terms',
    content: 'Fabric to be delivered in rolls with shade and lot marked. Shade continuity certificate required with every dispatch.',
  },
];

export const OVERHEADS = [
  { name: 'Factory Overhead', type: 'Overheads', defaultCost: 0.35 },
  { name: 'Administrative Overhead', type: 'Overheads', defaultCost: 0.18 },
  { name: 'Financial Cost', type: 'Overheads', defaultCost: 0.12 },
];

// ── Manufacturing ──────────────────────────────────────────────────
export const PROCESSES = [
  { name: 'Cutting', type: 'Manufacturing', defaultCost: 0.12 },
  { name: 'Sewing', type: 'Manufacturing', defaultCost: 0.85 },
  { name: 'Finishing', type: 'Manufacturing', defaultCost: 0.22 },
  { name: 'Ironing', type: 'Manufacturing', defaultCost: 0.09 },
  { name: 'Packing', type: 'Manufacturing', defaultCost: 0.07 },
];

export const PARTS = [
  { name: 'Front Panel' },
  { name: 'Back Panel' },
  { name: 'Sleeve' },
  { name: 'Collar' },
  { name: 'Cuff' },
  { name: 'Pocket' },
];

// ── Quality control ────────────────────────────────────────────────
export const DEFECT_TYPES = [
  { name: 'Hole', category: 'Fabric', severity: 'Major' },
  { name: 'Stain', category: 'Fabric', severity: 'Major' },
  { name: 'Slub', category: 'Fabric', severity: 'Minor' },
  { name: 'Shade Variation', category: 'Fabric', severity: 'Critical' },
  { name: 'Yarn Contamination', category: 'Fabric', severity: 'Major' },
];

export const TRIMS_QC_CRITERIA = [
  { name: 'Colour Matching', description: 'Trim colour matches the approved lab dip' },
  { name: 'Dimension Check', description: 'Length and width within the approved tolerance' },
  { name: 'Pull Test', description: 'Button and snap attachment strength' },
  { name: 'Rust / Corrosion', description: 'Metal trims free from rust and corrosion' },
];

export default {
  UOMS,
  UOM_NAME_BY_SYMBOL,
  ATTRIBUTES,
  CATEGORIES,
  SUB_CATEGORIES,
  ITEM_TYPES,
  ITEMS,
  BUYERS,
  SUPPLIERS,
  SIZE_PRESETS,
  STYLES,
  PAYMENT_TERMS,
  TERMS_CONDITIONS,
  OVERHEADS,
  PROCESSES,
  PARTS,
  DEFECT_TYPES,
  TRIMS_QC_CRITERIA,
};
