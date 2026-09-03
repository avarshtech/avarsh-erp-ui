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
// The buyer form requires at least one shipping location, captured in a nested modal.
export const BUYERS = [
  {
    name: 'H&M Hennes & Mauritz AB',
    code: 'HM',
    currency: 'USD',
    email: 'sourcing@hm-buying.example.com',
    phone: '+46812345678',
    location: {
      label: 'Stockholm DC',
      address: 'Master Samuelsgatan 46A',
      country: 'Sweden',
      postalCode: '10638',
      city: 'Stockholm',
      state: 'Stockholm County',
    },
  },
  {
    name: 'Primark Stores Ltd',
    code: 'PRIMARK',
    currency: 'GBP',
    email: 'orders@primark-buying.example.com',
    phone: '+442071234567',
    location: {
      label: 'Dublin DC',
      address: '22-24 Parnell Street',
      country: 'Ireland',
      postalCode: 'D01 E7P6',
      city: 'Dublin',
      state: 'Leinster',
    },
  },
];

// Phone must be exactly 10 digits (no country code); Pincode, PAN and GSTIN are all
// mandatory on the supplier form.
export const SUPPLIERS = [
  {
    name: 'Arvind Mills Ltd',
    code: 'ARVIND',
    supplies: 'Fabric',
    gstin: '24AABCA1234M1Z5',
    pan: 'AABCA1234M',
    email: 'sales@arvind-mills.example.com',
    phone: '9876543210',
    address: 'Naroda Road, Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380025',
  },
  {
    name: 'Coats India Pvt Ltd',
    code: 'COATS',
    supplies: 'Local Trims',
    gstin: '33AAACC5678N1Z2',
    pan: 'AAACC5678N',
    email: 'orders@coats-india.example.com',
    phone: '9845012345',
    address: 'Ambattur Industrial Estate, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600058',
  },
  {
    name: 'YKK India Pvt Ltd',
    code: 'YKK',
    supplies: 'Imported Trims',
    gstin: '06AAACY9012P1Z8',
    pan: 'AAACY9012P',
    email: 'export@ykk-india.example.com',
    phone: '9812345678',
    address: 'Bawal Industrial Area, Rewari',
    city: 'Rewari',
    state: 'Haryana',
    pincode: '123501',
  },
];

// ── Style management ───────────────────────────────────────────────
export const SIZE_PRESETS = [
  { name: 'Tops S-XXL', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { name: 'Bottoms 28-38', sizes: ['28', '30', '32', '34', '36', '38'] },
];

// Season is two fields on the form: a code Select (labelled with the full season
// name, e.g. "Spring/Summer") and a year Select.
export const STYLES = [
  {
    styleNo: 'HM-TS-2601',
    name: "Men's Crew Neck T-Shirt",
    buyer: 'H&M Hennes & Mauritz AB',
    sizePreset: 'Tops S-XXL',
    seasonLabel: 'Spring/Summer',
    seasonYear: '2026',
    description: 'Short sleeve crew neck tee, single jersey, side seamed',
  },
  {
    styleNo: 'HM-PL-2602',
    name: 'Ladies Pique Polo Shirt',
    buyer: 'H&M Hennes & Mauritz AB',
    sizePreset: 'Tops S-XXL',
    seasonLabel: 'Spring/Summer',
    seasonYear: '2026',
    description: 'Short sleeve pique polo with rib collar and 3-button placket',
  },
  {
    styleNo: 'PRK-DN-2603',
    name: "Men's Slim Fit Denim Jeans",
    buyer: 'Primark Stores Ltd',
    sizePreset: 'Bottoms 28-38',
    seasonLabel: 'Autumn/Winter',
    seasonYear: '2026',
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

// ── Cost sheets ────────────────────────────────────────────────────
/**
 * Two cost sheets, one per garment type, built from the seeded variants.
 *
 * Fabric/trim rows reference VARIANT names — the costing pickers query
 * GET /variants/search and the server reads the row's display name off the variant.
 * Consumption is expressed in each item's consumption (secondary) UOM, which is what
 * the row's UOM addon shows: MTR for fabrics and thread, PCS for labels and buttons.
 */
export const COST_SHEETS = [
  {
    styleNo: 'HM-TS-2601',
    buyer: 'H&M Hennes & Mauritz AB',
    garmentName: "Men's Crew Neck T-Shirt",
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    profitPct: 12,
    fabrics: [
      { variant: 'Single Jersey 180 GSM Navy Blue', classification: 'Knits', consumption: 1.45, price: 2.1 },
      { variant: 'Rib 1x1 240 GSM Navy Blue', classification: 'Knits', consumption: 0.08, price: 2.4 },
    ],
    localTrims: [
      { variant: 'Sewing Thread 40s2 Navy Blue', consumption: 150, cost: 0.0015 },
      { variant: 'Woven Main Label Medium White', consumption: 1, cost: 0.04 },
      { variant: 'Care Label Standard White', consumption: 1, cost: 0.02 },
      { variant: 'Hang Tag Recycled Kraft Brown', consumption: 1, cost: 0.05 },
    ],
    importedTrims: [],
    processes: ['Cutting', 'Sewing', 'Finishing', 'Ironing', 'Packing'],
    overheads: ['Factory Overhead', 'Administrative Overhead', 'Financial Cost'],
  },
  {
    styleNo: 'HM-PL-2602',
    buyer: 'H&M Hennes & Mauritz AB',
    garmentName: 'Ladies Pique Polo Shirt',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    profitPct: 13,
    fabrics: [
      { variant: 'Pique 220 GSM Royal Blue', classification: 'Knits', consumption: 1.65, price: 2.55 },
      { variant: 'Rib 1x1 240 GSM White', classification: 'Knits', consumption: 0.12, price: 2.4 },
    ],
    localTrims: [
      { variant: 'Sewing Thread 40s2 White', consumption: 160, cost: 0.0015 },
      { variant: '4-Hole Button 18L White', consumption: 3, cost: 0.012 },
      { variant: 'Woven Main Label Medium White', consumption: 1, cost: 0.04 },
      { variant: 'Care Label Standard White', consumption: 1, cost: 0.02 },
    ],
    importedTrims: [
      { variant: 'Fusible Interlining 50 GSM White', consumption: 0.05, costUsd: 0.6 },
    ],
    processes: ['Cutting', 'Sewing', 'Finishing', 'Ironing', 'Packing'],
    overheads: ['Factory Overhead', 'Administrative Overhead', 'Financial Cost'],
  },
  {
    styleNo: 'PRK-DN-2603',
    buyer: 'Primark Stores Ltd',
    garmentName: "Men's Slim Fit Denim Jeans",
    sizes: ['28', '30', '32', '34', '36', '38'],
    profitPct: 14,
    fabrics: [
      { variant: 'Denim 12 Oz Indigo Blue', classification: 'Woven', consumption: 1.35, price: 3.8 },
    ],
    localTrims: [
      { variant: 'Sewing Thread 60s3 Black', consumption: 200, cost: 0.0018 },
      { variant: 'Metal Snap Button 20L Antique Brass', consumption: 1, cost: 0.09 },
      { variant: 'Woven Main Label Large White', consumption: 1, cost: 0.04 },
    ],
    importedTrims: [
      { variant: 'Metal Zipper No5 Antique Brass 16cm', consumption: 1, costUsd: 0.28 },
    ],
    processes: ['Cutting', 'Sewing', 'Finishing', 'Ironing', 'Packing'],
    overheads: ['Factory Overhead', 'Administrative Overhead', 'Financial Cost'],
  },
];

// ── Buyer orders ───────────────────────────────────────────────────
/**
 * Orders are raised against an approved cost sheet: entering the Costing ID auto-fills
 * buyer, style, garment name, currency and fabric description. Everything below is what
 * the merchandiser still has to supply.
 *
 * `destination` must match a shipping location on the buyer (see BUYERS.location.label).
 * Quantities are a colour x size matrix; `price` is applied to every size via "Apply All".
 */
export const ORDERS = [
  {
    styleNo: 'HM-TS-2601',
    material: 'Knit',
    component: 'Single',
    paymentTerms: 'TT 30 Days',
    paymentDays: 30,
    buyerPoNo: 'HM-PO-880412',
    destination: 'Stockholm DC',
    dispatchInDays: 75,
    sizePreset: 'Tops S-XXL',
    price: 6.95,
    colors: [
      { name: 'Navy Blue', quantities: { S: 600, M: 1200, L: 1200, XL: 800, XXL: 400 } },
      { name: 'White', quantities: { S: 400, M: 800, L: 800, XL: 600, XXL: 200 } },
    ],
  },
  {
    styleNo: 'PRK-DN-2603',
    material: 'Woven',
    component: 'Single',
    paymentTerms: 'LC at Sight 60 Days',
    paymentDays: 60,
    buyerPoNo: 'PRK-PO-551207',
    destination: 'Dublin DC',
    dispatchInDays: 95,
    sizePreset: 'Bottoms 28-38',
    price: 10.4,
    colors: [
      { name: 'Indigo Blue', quantities: { 28: 300, 30: 700, 32: 900, 34: 900, 36: 500, 38: 200 } },
    ],
  },
];

// ── Bills of Materials ─────────────────────────────────────────────
/**
 * A BOM is built against a confirmed ORDER (not a cost sheet): BOMForm looks the order
 * up by number and derives quantities and colours from its lines.
 *
 * Each line is identified by the Category / Sub-Category / Item Type triple — that
 * combination resolves to exactly one item, whose variants then populate the Variant
 * dropdown. Only Fabric and Trims categories are accepted by the BOM.
 *
 * `consumption` is per garment, in the item's consumption (secondary) UOM. Items with a
 * UOM conversion (fabric KG↔MTR, buttons GRS↔PCS, thread CON↔MTR) are the ones that
 * exercise purchaseQtyPrimary.
 */
export const BOMS = [
  {
    styleNo: 'HM-TS-2601',
    lines: [
      {
        category: 'Fabric', subCategory: 'Knits', itemType: 'Single Jersey',
        variant: 'Single Jersey 180 GSM Navy Blue',
        parts: ['Front Panel', 'Back Panel', 'Sleeve'],
        consumption: 1.45,
        processes: ['Cutting', 'Sewing'],
      },
      {
        category: 'Fabric', subCategory: 'Knits', itemType: 'Rib 1x1',
        variant: 'Rib 1x1 240 GSM Navy Blue',
        parts: ['Collar'],
        consumption: 0.08,
        processes: ['Cutting', 'Sewing'],
      },
      {
        category: 'Local Trims', subCategory: 'Sewing Threads', itemType: 'Spun Polyester Thread',
        variant: 'Sewing Thread 40s2 Navy Blue',
        parts: ['Front Panel'],
        consumption: 150,
        processes: ['Sewing'],
      },
      {
        category: 'Local Trims', subCategory: 'Labels & Tags', itemType: 'Woven Main Label',
        variant: 'Woven Main Label Medium White',
        parts: ['Back Panel'],
        consumption: 1,
        processes: ['Sewing'],
      },
    ],
  },
  {
    styleNo: 'PRK-DN-2603',
    lines: [
      {
        category: 'Fabric', subCategory: 'Denim', itemType: 'Denim 3x1 RHT',
        variant: 'Denim 12 Oz Indigo Blue',
        parts: ['Front Panel', 'Back Panel', 'Pocket'],
        consumption: 1.35,
        processes: ['Cutting', 'Sewing'],
      },
      {
        category: 'Local Trims', subCategory: 'Buttons & Fasteners', itemType: 'Metal Snap Button',
        variant: 'Metal Snap Button 20L Antique Brass',
        parts: ['Front Panel'],
        consumption: 1,
        processes: ['Sewing'],
      },
      {
        category: 'Imported Trims', subCategory: 'Zippers', itemType: 'Metal Zipper',
        variant: 'Metal Zipper No5 Antique Brass 16cm',
        parts: ['Front Panel'],
        consumption: 1,
        processes: ['Sewing'],
      },
    ],
  },
];

// ── Purchase Orders ────────────────────────────────────────────────
/**
 * A PO is raised on ONE supplier and pulls its lines from a BOM, so the BOM's lines are
 * split across suppliers by material: fabric from the mill, threads and labels from the
 * trims supplier, zippers from the zip maker.
 *
 * `lines` names the variants to pick from that BOM, with the agreed unit price. The
 * quantity comes from the BOM's purchaseQtyPrimary — i.e. in the PURCHASE UOM (KG,
 * Cones, Gross), which is the whole point of the UOM conversion chain.
 */
export const PURCHASE_ORDERS = [
  {
    supplier: 'Arvind Mills Ltd',
    orderNo: 'SG/26-27/1001',
    deliveryInDays: 30,
    terms: 'Fabric Delivery Terms',
    lines: [
      { variant: 'Single Jersey 180 GSM Navy Blue', unitPrice: 6.7 },
      { variant: 'Rib 1x1 240 GSM Navy Blue', unitPrice: 7.2 },
    ],
  },
  {
    supplier: 'Coats India Pvt Ltd',
    orderNo: 'SG/26-27/1001',
    deliveryInDays: 25,
    terms: 'Standard Purchase Terms',
    lines: [
      { variant: 'Sewing Thread 40s2 Navy Blue', unitPrice: 7.5 },
      { variant: 'Woven Main Label Medium White', unitPrice: 0.04 },
    ],
  },
  {
    supplier: 'YKK India Pvt Ltd',
    orderNo: 'SG/26-27/1002',
    deliveryInDays: 35,
    terms: 'Standard Purchase Terms',
    lines: [
      { variant: 'Metal Zipper No5 Antique Brass 16cm', unitPrice: 0.28 },
    ],
  },
];

/**
 * Session 6 — goods receipt against the POs above.
 *
 * Fabric is received as ROLLS (roll number + shade lot are the mill's identity for a
 * cut of fabric, and shade lot is what stops two dye batches being mixed in one
 * garment). Everything else — trims, packing — is received as CARTONS.
 *
 * `receivingQty` is expressed in the PURCHASE UOM, matching the PO: KG for fabric,
 * Cones for thread, Pieces for labels and zippers. The carton quantity mirrors the
 * received quantity because these GRNs pack the full receipt.
 */
export const GRNS = [
  {
    type: 'Fabric',
    supplier: 'Arvind Mills Ltd',
    challanNo: 'ARV/DC/2026-0451',
    vehicleNumber: 'TN-38-BQ-7712',
    transporter: 'Sharma Roadlines',
    lines: [
      { variant: 'Single Jersey 180 GSM Navy Blue', rollNumber: 'ARV-SJ-NB-001', receivingQty: 1903.125, shadeLot: 'SL-NB-2601' },
      { variant: 'Rib 1x1 240 GSM Navy Blue', rollNumber: 'ARV-RB-NB-001', receivingQty: 140, shadeLot: 'SL-NB-2601' },
    ],
  },
  {
    type: 'Accessories',
    supplier: 'Coats India Pvt Ltd',
    challanNo: 'COATS/DC/2026-1187',
    vehicleNumber: 'TN-11-CH-3390',
    transporter: 'VRL Logistics',
    lines: [
      { variant: 'Sewing Thread 40s2 Navy Blue', cartonNumber: 'CTN-THR-001', receivingQty: 210 },
      { variant: 'Woven Main Label Medium White', cartonNumber: 'CTN-LBL-001', receivingQty: 7000 },
    ],
  },
  {
    type: 'Accessories',
    supplier: 'YKK India Pvt Ltd',
    challanNo: 'YKK/DC/2026-0902',
    vehicleNumber: 'KA-05-MJ-6624',
    transporter: 'Blue Dart Surface',
    lines: [
      { variant: 'Metal Zipper No5 Antique Brass 16cm', cartonNumber: 'CTN-ZIP-001', receivingQty: 3500 },
    ],
  },
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
  COST_SHEETS,
  ORDERS,
  BOMS,
  PURCHASE_ORDERS,
  GRNS,
};
