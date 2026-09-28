import { FABRIC_CLASSIFICATIONS } from '../../../../utils/costingConstants';

/**
 * The five row sections of a cost sheet. One generic grid renders all of them from these
 * definitions, so a column added here appears everywhere it is read (grid, details, payload).
 *
 * Column spec types: master (variant / process / overhead picker), consumption, rate, pct,
 * amount, money, text, select, vendor. `main` columns sit in the grid; `details` open under a
 * row when it is expanded, keeping the grid narrow enough to sit beside the live price panel.
 * Titles keep the old sheet's wording — the e2e helpers address cells by header prefix.
 */
export const SECTION_KEYS = ['fabric', 'localTrim', 'importedTrim', 'manufacturing', 'overhead'];

const trimDetails = [
  { type: 'text', field: 'code', title: 'Code', placeholder: 'Item code' },
  { type: 'text', field: 'size', title: 'Size', placeholder: 'Size' },
];

export const SECTION_CONFIG = {
  fabric: {
    payloadKey: 'fabricRows',
    prefix: 'f',
    addText: 'Add Fabric',
    emptyText: 'No fabrics yet. Type a fabric name below, or start from a template.',
    master: { kind: 'variant', slot: 'fabric', title: 'Fabric Name', nameField: 'fabricType' },
    amountField: 'netCost',
    total: { key: 'fabric', label: 'Total Fabric Cost' },
    main: [
      { type: 'master', width: 230 },
      { type: 'consumption', title: 'Consumption', width: 200, calculators: true },
      { type: 'rate', field: 'fabricPrice', title: 'Price', currency: 'costing', width: 170, placeholder: 'Rate' },
      { type: 'pct', field: 'allowancePct', title: 'Allowance %', width: 95 },
      { type: 'pct', field: 'wastagePct', title: 'Wastage %', width: 95 },
      { type: 'amount', field: 'netCost', title: 'Net Cost', currency: 'costing', width: 120 },
    ],
    details: [
      { type: 'select', field: 'classification', title: 'Classification', options: FABRIC_CLASSIFICATIONS },
      { type: 'text', field: 'description', title: 'Description', placeholder: 'Fabric desc' },
      { type: 'text', field: 'fabricWidthStd', title: 'Width (Std)', placeholder: 'e.g. 58"' },
      { type: 'text', field: 'fabricWidthVendor', title: 'Width (Vendor)', placeholder: 'e.g. 58"' },
      { type: 'vendor', title: 'Vendor' },
    ],
  },
  localTrim: {
    payloadKey: 'localTrims',
    prefix: 'lt',
    addText: 'Add Local Item',
    emptyText: 'No local accessories yet.',
    master: { kind: 'variant', slot: 'localTrim', title: 'Item', nameField: 'item' },
    amountField: 'price',
    total: { key: 'local', label: 'Local Accessories Total' },
    main: [
      { type: 'master', width: 230 },
      { type: 'consumption', title: 'Consumption', width: 150 },
      { type: 'rate', field: 'cost', title: 'Cost', currency: 'costing', width: 170, placeholder: 'Cost' },
      { type: 'amount', field: 'price', title: 'Price', currency: 'costing', width: 120 },
    ],
    details: trimDetails,
  },
  importedTrim: {
    payloadKey: 'importedTrims',
    prefix: 'it',
    addText: 'Add Imported Item',
    emptyText: 'No imported accessories yet.',
    master: { kind: 'variant', slot: 'importedTrim', title: 'Item', nameField: 'item' },
    amountField: 'priceUsd',
    total: { key: 'importedUsd', label: 'Imported Accessories Total (USD)', currency: 'USD' },
    main: [
      { type: 'master', width: 230 },
      { type: 'consumption', title: 'Consumption', width: 150 },
      { type: 'rate', field: 'costUsd', title: 'Cost ($ USD)', currency: 'USD', width: 170, placeholder: 'Cost' },
      { type: 'amount', field: 'priceUsd', title: 'Price ($ USD)', currency: 'USD', width: 120 },
    ],
    details: trimDetails,
  },
  manufacturing: {
    payloadKey: 'manufacturingRows',
    prefix: 'm',
    addText: 'Add Process',
    emptyText: 'No manufacturing costs yet.',
    master: { kind: 'process', title: 'Process' },
    amountField: 'cost',
    total: { key: 'manufacturing', label: 'Total Manufacturing Cost' },
    main: [
      { type: 'master', width: 220 },
      { type: 'vendor', title: 'Vendor', width: 180 },
      { type: 'money', field: 'cost', title: 'Cost', currency: 'costing', width: 130 },
      { type: 'text', field: 'comments', title: 'Comments', placeholder: 'Notes' },
    ],
    details: [],
  },
  overhead: {
    payloadKey: 'overheadRows',
    prefix: 'o',
    addText: 'Add Overhead',
    emptyText: 'No overhead costs yet.',
    master: { kind: 'overhead', title: 'Description' },
    amountField: 'cost',
    total: { key: 'markup', label: 'Total Markup Cost' },
    main: [
      { type: 'master', width: 220 },
      { type: 'money', field: 'cost', title: 'Cost', currency: 'costing', width: 130 },
      { type: 'text', field: 'comments', title: 'Comments', placeholder: 'Notes' },
    ],
    details: [],
  },
};

/** The note each section writes to (the two trim sections share one). */
export const SECTION_NOTE = {
  fabric: 'fabric',
  localTrim: 'trims',
  importedTrim: 'trims',
  manufacturing: 'manufacturing',
  overhead: 'overhead',
};
