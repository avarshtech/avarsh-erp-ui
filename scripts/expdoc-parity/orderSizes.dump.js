// Parity fixtures for src/utils/orderSizes.js -> erp-purchase OrderMetas (README.md), written to orderSizes.json: what
// a packing list keeps of each order it carries. expDocOrderMeta.orderMetaFor reads GET /orders/{id} and the size
// presets and keeps the order's sizes in preset order, its quantities per buyer PO, colour and size, and its buyer
// POs; Carton Packing reads an order the same way.
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The orders are the API's OrderDTO as the browser receives it (null fields left out): JOMO's polo with three buyer PO
// lines, one PO going to two destinations; VGT's tee in kids' heights; Prenatal's bodysuit in baby sizes; a shirt
// order without PO numbers or prices; jeans in waist sizes on two lines. Fixed data: nothing depends on today's date.
//
// Key order. A size map reaches the browser in the order the API writes it (jsonb keeps keys in an order of its own,
// not the order they were typed in), and JavaScript then lists keys that are array indexes ("74", "104") first, in
// numeric order, before the others in the order written. The cases given as JSON text (argsJson) carry their maps in
// orders no JavaScript object has, so the port, reading them in text order, must re-order as the browser does.
import { test, expect } from 'vitest';
import * as orderSizes from '../../src/utils/orderSizes.js';
import { writeFixtures } from './writeFixtures.js';

const { resolveOrderSizes, orderBreakdownOf, orderPosOf } = orderSizes;

const sum = (quantities) => Object.values(quantities).reduce((s, q) => s + (Number(q) || 0), 0);
/** A colour row as OrderLineColorDTO gives it. */
const colour = (id, sortOrder, colorName, quantities) => ({
  id, sortOrder, colorName, quantities, total: sum(quantities),
});
/** An order line as OrderLineDTO gives it; `fields` carry the PO, destination, dates and preset when the line has them. */
const line = (id, lineNo, fields, sizePrices, colorRows) => ({
  id,
  lineNo,
  ...fields,
  ...(sizePrices ? { sizePrices } : {}),
  colorRows,
  lineQty: colorRows.reduce((s, cr) => s + cr.total, 0),
});
const order = (id, fields, orderLines) => ({
  id,
  version: 4,
  orderNo: `SG/26-27/${id}`,
  status: 'IN_PRODUCTION',
  orderDate: '2026-08-14',
  currency: 'EUR',
  ...fields,
  orderLines,
});

const PRESET = {
  men: {
    id: 3, version: 0, name: 'Men M-XXXL', category: 'Mens', region: 'EU', sizes: ['M', 'L', 'XL', 'XXL', 'XXXL'], active: true,
  },
  kids: {
    id: 7,
    version: 2,
    name: 'Kids EU 74-140',
    category: 'Kids',
    region: 'EU',
    sizes: ['74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140'],
    active: true,
  },
  baby: {
    id: 9, version: 0, name: 'Baby 50/56-86/92', category: 'Baby', region: 'EU', sizes: ['50/56', '62/68', '74/80', '86/92'], active: true,
  },
  unisex: {
    id: 12, version: 1, name: 'Unisex XS-XXL', category: 'Unisex', region: 'EU', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], active: true,
  },
  waist: {
    id: 15, version: 0, name: 'Waist 28-40', category: 'Bottoms', region: 'EU', sizes: ['28', '30', '32', '34', '36', '38', '40'], active: true,
  },
};
const PRESETS = Object.values(PRESET);

const POLO = order(1042, {
  buyerId: 12, buyerName: 'JOMO BV', styleId: 441, styleNo: 'ST-2026-0441', garmentName: "Men's Slim Fit Polo",
  fabricDescription: '95% COTTON 5% ELASTANE',
}, [
  line(4201, 1, {
    buyerPoNo: 'PO-884213', destination: 'Rotterdam', dispatchDate: '2026-11-05', leadTime: 83, sizePresetId: 3,
  }, { M: 8.75, L: 8.75, XL: 8.75, XXL: 8.95 }, [
    colour(1, 1, 'Navy', { M: 488, L: 950, XL: 1500 }),
    colour(2, 2, 'Flame Scarlet 18-1662 TCX', { M: 49, L: 86, XL: 80, XXL: 40 }),
  ]),
  line(4202, 2, {
    buyerPoNo: 'PO-884214', destination: 'Hamburg DC', dispatchDate: '2026-11-12', leadTime: 90, sizePresetId: 3,
  }, { M: 9.1, L: 9.1, XL: 9.1 }, [colour(3, 1, 'Navy', { M: 156, L: 156, XL: 172 })]),
  line(4203, 3, {
    buyerPoNo: 'PO-884213', destination: 'Venlo DC', dispatchDate: '2026-11-19', revisedDispatchDate: '2026-11-24', sizePresetId: 3,
  }, { M: 8.75, L: 8.75 }, [colour(4, 1, 'Navy', { M: 100, L: 100 })]),
]);

const VGT = order(1055, {
  buyerId: 31, buyerName: 'Van Gennip Textiles BV', styleId: 512, styleNo: 'ST-2026-0512', garmentName: "Girls' Printed Tee",
  fabricDescription: '100% ORGANIC COTTON',
}, [
  line(5501, 1, {
    buyerPoNo: 'VGT-2026-771', destination: 'Antwerp', dispatchDate: '2026-11-20', sizePresetId: 7,
  }, {
    74: 4.1, 80: 4.1, 86: 4.2, 92: 4.2, 98: 4.35, 104: 4.35, 110: 4.5, 116: 4.5, 122: 4.65, 128: 4.65, 134: 4.8, 140: 4.8,
  }, [
    colour(11, 1, 'Ecru', { 74: 3600, 80: 3600, 86: 3600, 92: 3600, 98: 3600, 104: 3600 }),
    colour(12, 2, 'Dusty Rose', { 110: 3120, 116: 3120, 122: 3120, 128: 400, 134: 400, 140: 400 }),
  ]),
]);

const PRENATAL = order(1061, {
  buyerId: 40, buyerName: 'Prenatal Moeder en Kind BV', styleId: 588, styleNo: 'ST-2026-0588', garmentName: 'Baby 3-pack Bodysuit',
  fabricDescription: '100% COTTON INTERLOCK',
}, [
  line(6101, 1, {
    buyerPoNo: 'PRE-55120', destination: 'Rotterdam', dispatchDate: '2026-12-01', sizePresetId: 9,
  }, { '50/56': 6.9, '62/68': 6.9, '74/80': 6.9, '86/92': 6.9 }, [
    colour(21, 1, 'White', { '50/56': 384, '62/68': 384, '74/80': 384 }),
    colour(22, 2, 'Soft Blue', { '74/80': 288, '86/92': 264 }),
  ]),
]);

// No PO numbers and no size prices: only colour-wise quantities
const SHIRT = order(1070, {
  buyerId: 12, buyerName: 'JOMO BV', styleId: 601, styleNo: 'ST-2026-0601', garmentName: "Ladies' Woven Shirt",
  fabricDescription: '100% VISCOSE',
}, [
  line(7001, 1, { dispatchDate: '2026-12-10', sizePresetId: 12 }, null, [
    colour(31, 1, 'Sky Blue', { S: 120, M: 240, L: 240 }),
    colour(32, 2, 'White', { XS: 60, S: 120, M: 120 }),
  ]),
]);

// Waist sizes on two lines with different sizes; no preset on the first line
const JEANS = order(1081, {
  buyerId: 12, buyerName: 'JOMO BV', styleId: 650, styleNo: 'ST-2026-0650', garmentName: "Men's Slim Jeans",
  fabricDescription: '98% COTTON 2% ELASTANE DENIM',
}, [
  line(8101, 1, { buyerPoNo: 'PO-884300', destination: 'Rotterdam', dispatchDate: '2026-12-15' }, { 30: 14.2, 32: 14.2, 34: 14.2 }, [
    colour(41, 1, 'Indigo', { 30: 300, 32: 400, 34: 300 }),
  ]),
  line(8102, 2, {
    buyerPoNo: 'PO-884301', destination: 'Rotterdam', dispatchDate: '2026-12-22', sizePresetId: 15,
  }, { 28: 14.2, 36: 14.9, 38: 14.9 }, [
    colour(42, 1, 'Black Rinse', { 28: 100, 36: 200, 38: 100 }),
  ]),
]);

const [POLO_LINE] = POLO.orderLines;
const { sizePresetId: _preset, ...POLO_LINE_NO_PRESET } = POLO_LINE;
const withLines = (base, orderLines) => ({ ...base, orderLines });

const SIZE_CASES = [
  ['preset-order', [POLO, PRESETS]],
  ['presets-left-off', [POLO]],
  ['presets-null', [POLO, null]],
  ['preset-not-in-the-list', [POLO, [PRESET.kids, PRESET.baby]]],
  ['sizes-beyond-the-preset-follow-it', [withLines(POLO, [{
    ...POLO_LINE,
    sizePrices: { ...POLO_LINE.sizePrices, '3XL': 9.2 },
    colorRows: [...POLO_LINE.colorRows, colour(5, 3, 'Navy', { '4XL': 12, '3XL': 24, XXXL: 12 })],
  }]), PRESETS]],
  ['first-lines-preset-only', [withLines(POLO, [POLO_LINE_NO_PRESET, ...POLO.orderLines.slice(1)]), PRESETS]],
  ['preset-of-another-line-ignored', [JEANS, PRESETS]],
  ['preset-without-sizes', [POLO, [{ ...PRESET.men, sizes: [] }]]],
  ['preset-sizes-null', [POLO, [{ ...PRESET.men, sizes: null }]]],
  ['preset-repeats-a-size', [POLO, [{ ...PRESET.men, sizes: ['M', 'L', 'M', 'XL', 'XXL'] }]]],
  ['preset-in-other-case', [POLO, [{ ...PRESET.men, sizes: ['m', 'l', 'xl', 'xxl', 'xxxl'] }]]],
  ['quantities-only', [SHIRT, PRESETS]],
  ['quantities-only-without-preset', [SHIRT]],
  ['prices-only', [withLines(POLO, [{ ...POLO_LINE, colorRows: [] }]), PRESETS]],
  ['kids-heights', [VGT, PRESETS]],
  ['kids-heights-without-preset', [VGT]],
  ['baby-sizes', [PRENATAL, PRESETS]],
  ['waist-sizes-without-preset', [JEANS]],
  ['zero-quantities-still-name-sizes', [withLines(SHIRT, [line(7002, 1, { sizePresetId: 12 }, null, [colour(33, 1, 'Sky Blue', { XS: 0, S: 0, M: 20 })])]), PRESETS]],
  ['sizes-kept-as-written', [withLines(SHIRT, [line(7003, 1, { sizePresetId: 12 }, null, [colour(34, 1, 'Sky Blue', { ' M ': 10, M: 5, L: 5 })])]), PRESETS]],
  ['line-without-maps', [withLines(POLO, [{ id: 4209, lineNo: 1, sizePresetId: 3 }]), PRESETS]],
  ['no-lines', [{ id: 1099, orderNo: 'SG/26-27/1099' }, PRESETS]],
  ['lines-null', [{ id: 1099, orderLines: null }, PRESETS]],
  ['order-null', [null, PRESETS]],
];

// Size maps in text orders no JavaScript object has
const SIZE_JSON_CASES = [
  ['prices-in-server-order-no-preset',
    '[{"orderLines":[{"sizePresetId":null,"sizePrices":{"L":8.75,"M":8.75,"XL":8.75,"XXL":8.95},'
    + '"colorRows":[{"colorName":"Navy","quantities":{"XL":1500,"L":950,"M":488}}]}]}]'],
  ['heights-in-server-order', '[{"orderLines":[{"sizePrices":{"110":4.5,"74":4.1,"98":4.35,"80":4.1}}]}]'],
  ['letters-and-numbers', '[{"orderLines":[{"colorRows":[{"colorName":"Indigo","quantities":{"S":10,"32":5,"M":7,"30":4}}]}]}]'],
  ['numbers-beyond-the-preset',
    '[{"orderLines":[{"sizePresetId":3,"sizePrices":{"XL":1,"104":2,"M":3,"98":4}}]},'
    + '[{"id":3,"name":"Men M-XXXL","sizes":["M","L","XL","XXL","XXXL"]}]]'],
  ['leading-zero-is-not-a-number', '[{"orderLines":[{"colorRows":[{"colorName":"Navy","quantities":{"S":1,"08":2,"8":3,"M":4}}]}]}]'],
];

const qtyLine = (quantities, fields = {}, sizePrices = { M: 8.75, L: 8.75, XL: 8.75 }) => line(4290, 1, {
  buyerPoNo: 'PO-884213', destination: 'Rotterdam', dispatchDate: '2026-11-05', sizePresetId: 3, ...fields,
}, sizePrices, [colour(9, 1, 'Navy', quantities)]);

const BREAKDOWN_CASES = [
  ['jomo-three-po-lines', [POLO]],
  ['kids-heights', [VGT]],
  ['baby-sizes', [PRENATAL]],
  ['no-po-numbers-no-prices', [SHIRT]],
  ['two-lines-two-pos', [JEANS]],
  ['empty-quantities-left-out', [withLines(POLO, [qtyLine({
    S: 0, M: null, L: '', XL: 12, XXL: 'n/a',
  })])]],
  ['quantities-as-text', [withLines(POLO, [qtyLine({ M: '24', L: '12.5', XL: ' 6 ' })])]],
  ['negative-quantity-kept', [withLines(POLO, [qtyLine({ M: -5, L: 10 })])]],
  ['prices-zero-negative-text-blank', [withLines(POLO, [qtyLine({
    M: 10, L: 10, XL: 10, XXL: 10, XXXL: 10,
  }, {}, {
    M: 0, L: -1, XL: '8.75', XXL: '', XXXL: 'TBD',
  })])]],
  ['no-size-prices', [withLines(POLO, [qtyLine({ M: 10, L: 20 }, {}, null)])]],
  ['po-text-trimmed-blank-is-null', [withLines(POLO, [
    qtyLine({ M: 10 }, { buyerPoNo: ' PO-884213 ', destination: '  ' }),
    qtyLine({ L: 20 }, { buyerPoNo: '', destination: 'Rotterdam' }),
  ])]],
  ['order-without-style', [{ id: 1099, orderLines: [qtyLine({ M: 10 })] }]],
  ['colour-without-name', [withLines(POLO, [{ ...qtyLine({ M: 10 }), colorRows: [{ id: 9, sortOrder: 1, quantities: { M: 10 } }] }])]],
  ['colour-rows-null', [withLines(POLO, [{ ...POLO_LINE, colorRows: null }])]],
  ['quantities-null', [withLines(POLO, [{ ...POLO_LINE, colorRows: [{ id: 9, colorName: 'Navy', quantities: null }] }])]],
  ['no-lines', [{ id: 1099, styleNo: 'ST-2026-0999' }]],
  ['order-null', [null]],
];

const BREAKDOWN_JSON_CASES = [
  ['quantities-in-server-order',
    '[{"styleNo":"ST-2026-0441","orderLines":[{"buyerPoNo":"PO-884213","destination":"Rotterdam",'
    + '"sizePrices":{"L":8.75,"M":8.75,"XL":8.75},"colorRows":[{"colorName":"Navy","quantities":{"XL":1500,"L":950,"M":488}}]}]}]'],
  ['heights-first',
    '[{"styleNo":"ST-2026-0512","orderLines":[{"buyerPoNo":"VGT-2026-771","destination":"Antwerp",'
    + '"sizePrices":{"110":4.5,"74":4.1},"colorRows":[{"colorName":"Ecru","quantities":{"S":5,"110":3120,"74":3600}}]}]}]'],
];

const poLine = (buyerPoNo, destination, dispatchDate) => ({
  id: 9000, lineNo: 1, ...(buyerPoNo !== undefined ? { buyerPoNo } : {}), ...(destination !== undefined ? { destination } : {}),
  ...(dispatchDate !== undefined ? { dispatchDate } : {}), colorRows: [],
});

const PO_CASES = [
  ['jomo-three-pos', [POLO]],
  ['one-po', [VGT]],
  ['two-lines-two-pos', [JEANS]],
  ['lines-without-po-numbers', [SHIRT]],
  ['same-po-and-destination-once-first-date-kept', [{ orderLines: [
    poLine('PO-1', 'Rotterdam', '2026-11-05'), poLine('PO-1', 'Rotterdam', '2026-11-20'), poLine('PO-1', 'Antwerp', '2026-11-20'),
  ] }]],
  ['text-trimmed', [{ orderLines: [poLine(' PO-884213 ', ' Rotterdam ', '2026-11-05'), poLine('PO-884213', 'Rotterdam', '2026-11-30')] }]],
  ['blank-po-skipped', [{ orderLines: [poLine('   ', 'Rotterdam', '2026-11-05'), poLine('', 'Antwerp'), poLine('PO-1')] }]],
  ['blank-destination-is-none', [{ orderLines: [poLine('PO-1', '', '2026-11-05'), poLine('PO-1', null, '2026-12-01'), poLine('PO-1')] }]],
  ['po-in-other-case-is-another-po', [{ orderLines: [poLine('PO-AB1', 'Rotterdam'), poLine('po-ab1', 'Rotterdam')] }]],
  ['dispatch-date-missing', [{ orderLines: [poLine('PO-1', 'Antwerp')] }]],
  ['no-lines', [{ id: 1099 }]],
  ['lines-null', [{ orderLines: null }]],
  ['order-null', [null]],
];

const CASES = [
  ...SIZE_CASES.map(([id, args]) => ({ id: `resolveOrderSizes/${id}`, fn: resolveOrderSizes, args })),
  ...SIZE_JSON_CASES.map(([id, argsJson]) => ({ id: `resolveOrderSizes/json/${id}`, fn: resolveOrderSizes, argsJson })),
  ...BREAKDOWN_CASES.map(([id, args]) => ({ id: `orderBreakdownOf/${id}`, fn: orderBreakdownOf, args })),
  ...BREAKDOWN_JSON_CASES.map(([id, argsJson]) => ({ id: `orderBreakdownOf/json/${id}`, fn: orderBreakdownOf, argsJson })),
  { id: 'orderBreakdownOf/throws/null-line', fn: orderBreakdownOf, args: [withLines(POLO, [null])], throws: true },
  ...PO_CASES.map(([id, args]) => ({ id: `orderPosOf/${id}`, fn: orderPosOf, args })),
  { id: 'orderPosOf/throws/null-line', fn: orderPosOf, args: [withLines(POLO, [null])], throws: true },
];

test('orderSizes parity fixtures', () => {
  const { count } = writeFixtures('orderSizes', CASES, { api: orderSizes });
  expect(count).toBe(CASES.length);
});
