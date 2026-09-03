/**
 * Export Documentation — the PRD §14 validation catalogue.
 *
 * One registry, consulted by the validation panel, the submit gate, the approval
 * screen and the audit trail, so those four can never disagree about what is wrong
 * with a document.
 *
 * Policy (BR-03): ERROR blocks. WARN never blocks an authorised user — it blocks an
 * UNACKNOWLEDGED one. INFO is display-only.
 *
 * The load-bearing detail is acknowledgement keying. An acknowledgement records the
 * VALUES that triggered the warning, and only applies while those values still hold.
 * Without that, an approved override silently survives the edit that made it wrong.
 *
 * Coverage: V-01…V-13, V-15 and V-16 are here. V-14 deliberately is NOT — it asks
 * whether a carton has changed since it was PRINTED, which is a fact about sticker
 * run history rather than about the document, so it is computed in
 * `expDocMockStickers.checkStickerGeneration` from the stored per-carton hashes.
 *
 * PL rules read `ctx.pl`; invoice rules read `ctx.invoice` and `ctx.plTotals`,
 * because an invoice may cover several packing lists and its counterpart is the
 * aggregate rather than any one document.
 */
import { SEVERITY, PHASE, PACKING_TYPE } from './expDocConstants';
import {
  cartonCount, piecesPerCarton, sizeQtyPerCarton, toRanges, findRangeOverlaps,
  findRangeGaps, intersectRanges, formatRanges, orderVsPacked, canonical, fnv1a,
} from './expDocCalc';

// ─── Findings ───────────────────────────────────────────────────────────────────

/**
 * Stable identity for a finding: the rule plus the things it points at. Survives
 * unrelated edits, so acknowledging one warning does not clear another.
 */
export const makeTargetKey = (code, targets = []) =>
  `${code}|${targets.map((t) => `${t.type}:${t.id}`).sort().join(',')}`;

const finding = (code, severity, title, message, targets, values, acknowledgeable = false) => ({
  code,
  severity,
  title,
  message,
  targets: targets || [],
  values: values || {},
  targetKey: makeTargetKey(code, targets),
  acknowledgeable,
  acknowledged: false,
  acknowledgement: null,
});

const rowTarget = (row) => ({
  type: 'ROW',
  id: row.id,
  label: `Cartons ${row.cartonFrom ?? '?'}-${row.cartonTo ?? '?'}`,
});

/** A stored acknowledgement applies only while the values that triggered it hold. */
export const acknowledgementApplies = (ack, item) =>
  ack
  && ack.targetKey === item.targetKey
  && fnv1a(canonical(ack.values || {})) === fnv1a(canonical(item.values || {}));

const allRows = (pl) => (pl?.sections || []).flatMap((s) => s.rows || []);

const isBlank = (v) => v === null || v === undefined || v === '';

/** Read a dotted path, treating a missing branch as blank rather than throwing. */
const readPath = (obj, path) =>
  String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

/** "invoice.paymentTerms" -> "Payment terms", for a message a user can act on. */
const labelForPath = (path) => {
  const leaf = String(path).split('.').pop();
  const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// ─── Rule registry ──────────────────────────────────────────────────────────────

export const RULES = [
  {
    code: 'V-01',
    title: 'Duplicate carton number in the shipment',
    severity: SEVERITY.ERROR,
    phases: [PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    // Scoped to the SHIPMENT, not the document: two packing lists of one shipment
    // may not both claim carton 42. Compared as intervals, never as a set of carton
    // numbers, so an unbounded carton count stays affordable.
    evaluate: (ctx) => {
      const out = [];
      const mine = toRanges(allRows(ctx.pl));
      if (!mine.length) return out;
      (ctx.plsInShipment || [])
        .filter((other) => other.id !== ctx.pl?.id && !['CANCELLED', 'SUPERSEDED'].includes(other.status))
        .forEach((other) => {
          const clash = intersectRanges(mine, toRanges(allRows(other)));
          if (!clash.length) return;
          out.push(finding(
            'V-01',
            SEVERITY.ERROR,
            'Duplicate carton number in the shipment',
            `Carton ${formatRanges(clash)} already appears on ${other.plNo}. A shipment cannot contain two cartons with the same number.`,
            [{ type: 'PL', id: other.id, label: other.plNo }],
            { ranges: formatRanges(clash), otherPl: other.plNo },
          ));
        });
      return out;
    },
  },
  {
    code: 'V-02',
    title: 'Carton range overlap',
    severity: SEVERITY.ERROR,
    phases: [PHASE.EDIT, PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    evaluate: (ctx) => findRangeOverlaps(toRanges(allRows(ctx.pl))).map((hit) => finding(
      'V-02',
      SEVERITY.ERROR,
      'Carton range overlap',
      `Cartons ${formatRanges([{ from: hit.from, to: hit.to }])} appear in more than one row.`,
      [rowTarget(hit.a.row), rowTarget(hit.b.row)],
      { from: hit.from, to: hit.to },
    )),
  },
  {
    code: 'V-03',
    title: 'Gap in the carton sequence',
    severity: SEVERITY.WARN,
    // Legitimate when cartons are dropped, so warn and list the gaps rather than block.
    phases: [PHASE.SUBMIT, PHASE.APPROVE, PHASE.STICKER],
    evaluate: (ctx) => {
      const gaps = findRangeGaps(toRanges(allRows(ctx.pl)));
      if (!gaps.length) return [];
      return [finding(
        'V-03',
        SEVERITY.WARN,
        'Gap in the carton sequence',
        `Missing carton numbers: ${formatRanges(gaps)}. This is expected when cartons were dropped.`,
        [{ type: 'PL', id: ctx.pl?.id, label: ctx.pl?.plNo }],
        { gaps: formatRanges(gaps) },
        true,
      )];
    },
  },
  {
    code: 'V-06',
    title: 'Structurally impossible carton data',
    severity: SEVERITY.ERROR,
    phases: [PHASE.EDIT, PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    evaluate: (ctx) => {
      const out = [];
      allRows(ctx.pl).forEach((row) => {
        const label = `Cartons ${row.cartonFrom ?? '?'}-${row.cartonTo ?? '?'}`;
        const push = (msg, values) => out.push(finding(
          'V-06', SEVERITY.ERROR, 'Structurally impossible carton data',
          `${label}: ${msg}`, [rowTarget(row)], values,
        ));
        if (!row.cartonFrom || !row.cartonTo) push('the carton range is incomplete.', { from: row.cartonFrom, to: row.cartonTo });
        else if (Number(row.cartonTo) < Number(row.cartonFrom)) push('the "to" carton is before the "from" carton.', { from: row.cartonFrom, to: row.cartonTo });
        if (cartonCount(row) > 0 && piecesPerCarton(row) <= 0) push('pieces per carton works out to zero.', { pieces: piecesPerCarton(row) });
        if (row.packingType === PACKING_TYPE.RATIO && !Number(row.assortmentsPerCarton)) push('ratio cartons need assortments per carton.', { assortmentsPerCarton: row.assortmentsPerCarton });
        if (row.packingType === PACKING_TYPE.MPB && !Number(row.mpbPerCarton)) push('master-polybag cartons need MPB per carton.', { mpbPerCarton: row.mpbPerCarton });
        // Pieces are integers — always (PRD §24.15).
        Object.entries(sizeQtyPerCarton(row)).forEach(([size, qty]) => {
          if (qty < 0) push(`size ${size} has a negative quantity.`, { size, qty });
          else if (!Number.isInteger(qty)) push(`size ${size} has a fractional quantity; pieces must be whole numbers.`, { size, qty });
        });
      });
      return out;
    },
  },
  {
    code: 'V-07',
    title: 'Gross weight below net',
    severity: SEVERITY.WARN,
    phases: [PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    evaluate: (ctx) => {
      const out = [];
      allRows(ctx.pl).forEach((row) => {
        const net = Number(row.netWeightKg) || 0;
        const gross = Number(row.grossWeightKg) || 0;
        if (net > 0 && gross > 0 && gross < net) {
          out.push(finding(
            'V-07', SEVERITY.WARN, 'Gross weight below net',
            `Cartons ${row.cartonFrom}-${row.cartonTo}: gross ${gross} kg is below net ${net} kg.`,
            [rowTarget(row)], { net, gross }, true,
          ));
        }
      });
      // The same check at document level, because rounding can only ever make this worse.
      const t = ctx.totals;
      if (t && t.netWeightKg > 0 && t.grossWeightKg > 0 && t.grossWeightKg < t.netWeightKg) {
        out.push(finding(
          'V-07', SEVERITY.WARN, 'Gross weight below net',
          `Shipment total gross ${t.grossWeightKg} kg is below net ${t.netWeightKg} kg.`,
          [{ type: 'PL', id: ctx.pl?.id, label: ctx.pl?.plNo }],
          { net: t.netWeightKg, gross: t.grossWeightKg }, true,
        ));
      }
      return out;
    },
  },
  {
    code: 'V-08',
    title: 'Missing weight or dimension',
    // The one rule whose severity depends on the phase: a warning while drafting,
    // a hard error once a document that prints those fields is being generated.
    severity: (phase) =>
      (phase === PHASE.STICKER || phase === PHASE.DOC_GEN ? SEVERITY.ERROR : SEVERITY.WARN),
    phases: [PHASE.SUBMIT, PHASE.APPROVE, PHASE.STICKER, PHASE.DOC_GEN],
    evaluate: (ctx, phase) => {
      const tpl = ctx.template || {};
      /*
       * What counts as missing comes from the template's own list first.
       *
       * `mandatoryForDocGen` is the PRD's driver (§10.1) and says exactly which
       * carton fields this buyer's paper needs. `printWeights`/`printDimensions`
       * remain the fallback for a template that has not declared one, which is why
       * both are still read rather than replaced.
       */
      const declared = (tpl.mandatoryForDocGen || [])
        .filter((path) => String(path).startsWith('row.'))
        .map((path) => String(path).slice('row.'.length));
      const groups = declared.length
        ? [
          { label: 'weights', fields: declared.filter((f) => /weight/i.test(f)) },
          { label: 'dimensions', fields: declared.filter((f) => /^(lengthCm|breadthCm|heightCm)$/.test(f)) },
          {
            label: 'required carton fields',
            fields: declared.filter((f) => !/weight/i.test(f) && !/^(lengthCm|breadthCm|heightCm)$/.test(f)),
          },
        ].filter((g) => g.fields.length)
        : [
          { label: 'weights', fields: tpl.printWeights !== false ? ['netWeightKg', 'grossWeightKg'] : [] },
          { label: 'dimensions', fields: tpl.printDimensions !== false ? ['lengthCm', 'breadthCm', 'heightCm'] : [] },
        ].filter((g) => g.fields.length);
      if (!groups.length) return [];

      const hard = phase === PHASE.STICKER || phase === PHASE.DOC_GEN;
      const severity = hard ? SEVERITY.ERROR : SEVERITY.WARN;
      const out = [];
      allRows(ctx.pl).forEach((row) => {
        // A numeric carton field is missing when it is not a positive number; a
        // textual one when it is blank. Both shapes appear in mandatoryForDocGen.
        const missing = groups
          .filter((g) => g.fields.some((f) => (typeof row[f] === 'string'
            ? isBlank(row[f])
            : !(Number(row[f]) > 0))))
          .map((g) => g.label);
        if (!missing.length) return;
        out.push(finding(
          'V-08', severity, 'Missing weight or dimension',
          `Cartons ${row.cartonFrom}-${row.cartonTo}: ${missing.join(' and ')} missing, and this buyer's layout prints them.`,
          [rowTarget(row)], { missing: missing.join(','), from: row.cartonFrom, to: row.cartonTo },
          !hard,
        ));
      });
      return out;
    },
  },
  {
    code: 'V-04',
    title: 'Packed quantity differs from ordered (within tolerance)',
    severity: SEVERITY.INFO,
    phases: [PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    evaluate: (ctx) => variance(ctx).filter((v) => v.withinTolerance && v.variance !== 0).map((v) => finding(
      'V-04', SEVERITY.INFO, 'Packed quantity differs from ordered (within tolerance)',
      `${v.styleNo} ${v.colorName} ${v.size}: ordered ${v.orderQty}, packed ${v.shippedQty} (${v.variancePercent > 0 ? '+' : ''}${v.variancePercent}%), inside the ${ctx.tolerancePercent}% buyer tolerance.`,
      [{ type: 'LINE', id: `${v.styleNo}|${v.colorName}|${v.size}`, label: `${v.colorName} ${v.size}` }],
      { orderQty: v.orderQty, shippedQty: v.shippedQty },
    )),
  },
  {
    code: 'V-05',
    title: 'Packed quantity outside buyer tolerance',
    severity: SEVERITY.WARN,
    phases: [PHASE.SUBMIT, PHASE.APPROVE],
    evaluate: (ctx) => variance(ctx).filter((v) => !v.withinTolerance && v.orderQty > 0).map((v) => finding(
      'V-05', SEVERITY.WARN, 'Packed quantity outside buyer tolerance',
      `${v.styleNo} ${v.colorName} ${v.size}: ordered ${v.orderQty}, packed ${v.shippedQty} — ${v.status === 'SHORT' ? 'short' : 'excess'} ${Math.abs(v.variance)} pcs (${v.variancePercent > 0 ? '+' : ''}${v.variancePercent}%), outside the ${ctx.tolerancePercent}% tolerance.`,
      [{ type: 'LINE', id: `${v.styleNo}|${v.colorName}|${v.size}`, label: `${v.colorName} ${v.size}` }],
      { orderQty: v.orderQty, shippedQty: v.shippedQty },
      true,
    )),
  },
  {
    code: 'V-09',
    title: 'Colour or size is not on the order',
    severity: SEVERITY.WARN,
    phases: [PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    // Surfaced rather than hidden: orderVsPacked returns packed combinations absent
    // from the order with orderQty 0.
    evaluate: (ctx) => variance(ctx).filter((v) => v.orderQty === 0 && v.shippedQty > 0).map((v) => finding(
      'V-09', SEVERITY.WARN, 'Colour or size is not on the order',
      `${v.styleNo} ${v.colorName} ${v.size}: ${v.shippedQty} pcs packed, but this combination is not on the order.`,
      [{ type: 'LINE', id: `${v.styleNo}|${v.colorName}|${v.size}`, label: `${v.colorName} ${v.size}` }],
      { shippedQty: v.shippedQty },
      true,
    )),
  },
  {
    code: 'V-15',
    title: 'Over-packing against the order',
    severity: SEVERITY.WARN,
    phases: [PHASE.SAVE, PHASE.SUBMIT, PHASE.APPROVE],
    // Cumulative across the shipment's other packing lists, not just this one —
    // two lists can each look fine yet together exceed the order (BR-10).
    evaluate: (ctx) => {
      const packedElsewhere = ctx.packedElsewhere || {};
      if (!Object.keys(packedElsewhere).length) return [];
      // The map is keyed exactly as `packedQuantities` builds it: lowercased style,
      // the Pantone-aware colour key, double-pipe separators. Building the key any
      // other way makes every lookup miss and silently disables the rule.
      const matchColour = ctx.matchColour || ((c) => String(c ?? '').trim().toLowerCase());
      const keyOf = (styleNo, colour, size) =>
        `${String(styleNo ?? '').trim().toLowerCase()}||${matchColour(colour)}||${String(size ?? '').trim()}`;
      return variance(ctx)
        .map((v) => {
          const elsewhere = Number(packedElsewhere[keyOf(v.styleNo, v.colorName, v.size)]) || 0;
          const cumulative = elsewhere + v.shippedQty;
          if (!v.orderQty || cumulative <= v.orderQty) return null;
          return finding(
            'V-15', SEVERITY.WARN, 'Over-packing against the order',
            `${v.styleNo} ${v.colorName} ${v.size}: ${cumulative} pcs packed across this shipment against an order of ${v.orderQty} (${elsewhere} on other packing lists).`,
            // The TARGET id keeps the human-readable identity the other line rules
            // use, so an acknowledgement of V-05 and one of V-15 stay distinct but
            // both point at the same row.
            [{ type: 'LINE', id: `${v.styleNo}|${v.colorName}|${v.size}`, label: `${v.colorName} ${v.size}` }],
            { orderQty: v.orderQty, cumulative },
            true,
          );
        })
        .filter(Boolean);
    },
  },
  {
    code: 'V-12',
    title: 'Mandatory template field is empty',
    severity: SEVERITY.ERROR,
    phases: [PHASE.SUBMIT, PHASE.APPROVE, PHASE.INVOICE_SAVE, PHASE.INVOICE_APPROVE],
    evaluate: (ctx) => {
      // Two sources of "mandatory", and both count. `mandatoryForSubmit` is the
      // template's explicit list; a header field marked `mandatory` says the same
      // thing about itself, and reading only the first left those unchecked.
      const fromHeader = (ctx.template?.headerFields || [])
        .filter((f) => f.mandatory && f.binding && !String(f.binding).startsWith('fixed:'))
        .map((f) => ({ path: f.binding, label: f.label }));
      const required = [
        ...(ctx.template?.mandatoryForSubmit || []).map((path) => ({ path, label: null })),
        ...fromHeader,
      ].filter((r, i, arr) => arr.findIndex((x) => x.path === r.path) === i);
      const out = [];

      required.forEach(({ path, label }) => {
        const leaf = String(path).split('.').pop();
        if (String(path).startsWith('row.')) {
          allRows(ctx.pl).forEach((row) => {
            if (isBlank(row[leaf])) {
              out.push(finding(
                'V-12', SEVERITY.ERROR, 'Mandatory template field is empty',
                `Cartons ${row.cartonFrom}-${row.cartonTo}: "${leaf}" is required by the ${ctx.template?.name || 'buyer'} template.`,
                [rowTarget(row)], { field: leaf },
              ));
            }
          });
          return;
        }
        if (String(path).startsWith('invoice.')) {
          if (ctx.invoice && isBlank(readPath(ctx.invoice, String(path).slice('invoice.'.length)))) {
            out.push(finding(
              'V-12', SEVERITY.ERROR, 'Mandatory template field is empty',
              `${label || labelForPath(path)} is required by the ${ctx.template?.name || 'buyer'} template.`,
              [{ type: 'INVOICE_FIELD', id: path, label: label || labelForPath(path) }], { field: path },
            ));
          }
          return;
        }
        // Everything else is a document-scope path — pl.*, shipment.*, exporter.*.
        // Resolved against the same objects the renderer uses, so "mandatory" means
        // "will actually print a value" rather than "a key exists somewhere".
        const scope = { pl: ctx.pl, shipment: ctx.shipment, exporter: ctx.exporter, buyer: ctx.buyer };
        const root = String(path).split('.')[0];
        // A namespace this context cannot see is not an empty field. Reporting one
        // would raise a blocking error nobody could clear — the invoice screen has
        // no packing list of its own, and vice versa.
        if (scope[root] === undefined) return;
        if (isBlank(readPath(scope, path))) {
          out.push(finding(
            'V-12', SEVERITY.ERROR, 'Mandatory template field is empty',
            `${label || labelForPath(path)} is required by the ${ctx.template?.name || 'buyer'} template.`,
            [{ type: 'DOC_FIELD', id: path, label: label || labelForPath(path) }], { field: path },
          ));
        }
      });

      // PRD §8.5 names four more that no template has to opt into: an invoice
      // without an HS code, a rate, terms, or an FX rate when the IGST block is on
      // cannot be filed, whatever the buyer's layout says.
      if (ctx.invoice) {
        const inv = ctx.invoice;
        (inv.lines || []).filter((l) => !l.nonMerchandise).forEach((line) => {
          const missing = [];
          if (isBlank(line.hsCode)) missing.push('HS code');
          if (isBlank(line.rate) || !(Number(line.rate) > 0)) missing.push('rate');
          if (!missing.length) return;
          out.push(finding(
            'V-12', SEVERITY.ERROR, 'Mandatory invoice field is empty',
            `${line.description || `Line ${line.seq}`}: ${missing.join(' and ')} required.`,
            [{ type: 'INVOICE_LINE', id: line.id, label: `Line ${line.seq}` }],
            { line: line.id, missing },
          ));
        });
        if (ctx.template?.igst?.enabled && !(Number(inv.fxRate) > 0)) {
          out.push(finding(
            'V-12', SEVERITY.ERROR, 'Mandatory invoice field is empty',
            'The IGST block is enabled, so an exchange rate is required to state the taxable value in INR.',
            [{ type: 'INVOICE_FIELD', id: 'fxRate', label: 'Exchange rate' }], { field: 'fxRate' },
          ));
        }
      }
      return out;
    },
  },
  // ─── Invoice rules (PRD §8.5, §14) ────────────────────────────────────────────
  // These read ctx.invoice and ctx.plTotals rather than ctx.pl: an invoice may be
  // raised over several packing lists, so its counterpart is the aggregate, not a
  // single document.
  {
    code: 'V-10',
    title: 'Invoice totals do not match the packing list',
    severity: SEVERITY.WARN,
    phases: [PHASE.INVOICE_SAVE, PHASE.INVOICE_APPROVE],
    evaluate: (ctx) => {
      const inv = ctx.invoice;
      const pl = ctx.plTotals;
      if (!inv || !pl) return [];

      const out = [];
      // §8.3 / §24: a non-merchandise line (a sample charge, say) is legitimate and
      // is deliberately excluded from the quantity reconciliation — counting it
      // would report a variance that is not one.
      const merch = (inv.lines || []).filter((l) => !l.nonMerchandise);
      const lineQty = merch.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

      if (merch.length && Number(pl.pieces) !== lineQty) {
        out.push(finding(
          'V-10', SEVERITY.WARN, 'Invoice quantity does not match the packing list',
          `The invoice lines total ${lineQty.toLocaleString('en-IN')} pcs against ${
            Number(pl.pieces || 0).toLocaleString('en-IN')} pcs packed.`,
          [{ type: 'INVOICE', id: inv.id, label: 'Line quantities' }],
          { lineQty, plPieces: Number(pl.pieces) || 0 }, true,
        ));
      }

      // Each measure is its own finding so an acknowledged weight variance does not
      // silently cover a carton-count variance introduced later.
      const measures = [
        { key: 'cartons', label: 'Cartons', dp: 0 },
        { key: 'netWeightKg', label: 'Net weight (kg)', dp: 3 },
        { key: 'grossWeightKg', label: 'Gross weight (kg)', dp: 3 },
        { key: 'cbm', label: 'CBM', dp: 3 },
      ];
      measures.forEach(({ key, label, dp }) => {
        const stated = inv.totalsOverride?.[key];
        // Untouched totals are the packing list's own, so there is nothing to compare.
        if (stated === null || stated === undefined || stated === '') return;
        const a = Number(stated);
        const b = Number(pl[key]) || 0;
        if (!Number.isFinite(a) || a.toFixed(dp) === b.toFixed(dp)) return;
        out.push(finding(
          'V-10', SEVERITY.WARN, `Invoice ${label.toLowerCase()} does not match the packing list`,
          `The invoice states ${a.toFixed(dp)} against ${b.toFixed(dp)} on the packing list.`,
          [{ type: 'INVOICE_TOTAL', id: key, label }],
          { measure: key, stated: a, packed: b }, true,
        ));
      });
      return out;
    },
  },
  {
    code: 'V-11',
    title: 'Rate deviates from the order price',
    severity: SEVERITY.WARN,
    phases: [PHASE.INVOICE_SAVE, PHASE.INVOICE_APPROVE],
    evaluate: (ctx) => {
      const inv = ctx.invoice;
      if (!inv) return [];
      const limit = Number(ctx.rateDeviationPercent) || 0;
      if (limit <= 0) return [];
      return (inv.lines || [])
        .map((line) => {
          if (line.nonMerchandise) return null;
          const rate = Number(line.rate);
          const orderRate = Number(line.orderRate);
          // No order price means the line could not be priced from the order — which
          // is not the same as a deviation of 100%. Nothing to compare, so nothing
          // to warn about; V-12 is what catches a rate that is simply missing.
          if (!Number.isFinite(rate) || !Number.isFinite(orderRate) || orderRate <= 0) return null;
          const deviation = ((rate - orderRate) / orderRate) * 100;
          if (Math.abs(deviation) <= limit) return null;
          return finding(
            'V-11', SEVERITY.WARN, 'Rate deviates from the order price',
            `${line.description || `Line ${line.seq}`}: ${rate} against the order's ${orderRate} (${
              deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%, limit ±${limit}%).`,
            [{ type: 'INVOICE_LINE', id: line.id, label: `Line ${line.seq}` }],
            { rate, orderRate, deviationPct: Number(deviation.toFixed(4)) }, true,
          );
        })
        .filter(Boolean);
    },
  },
  {
    code: 'V-13',
    title: 'Invoice was built on an older packing list',
    severity: SEVERITY.WARN,
    phases: [PHASE.INVOICE_OPEN, PHASE.INVOICE_SAVE, PHASE.INVOICE_APPROVE],
    evaluate: (ctx) => {
      const inv = ctx.invoice;
      if (!inv) return [];
      // contentHash, not version: a save that changed nothing must not invalidate a
      // downstream invoice, or the warning becomes noise and stops being read.
      return (inv.packingListRefs || [])
        .map((ref) => {
          const live = (ctx.livePls || []).find((p) => p.id === ref.plId);
          if (!live || !ref.plContentHash || live.contentHash === ref.plContentHash) return null;
          return finding(
            'V-13', SEVERITY.WARN, 'Invoice was built on an older packing list',
            `${ref.plNo} has changed since these lines were generated. Regenerate from the packing list to pick the change up.`,
            [{ type: 'PACKING_LIST', id: ref.plId, label: ref.plNo }],
            { plId: ref.plId, was: ref.plContentHash, now: live.contentHash }, true,
          );
        })
        .filter(Boolean);
    },
  },
  {
    code: 'V-16',
    title: 'This packing list is already invoiced',
    severity: SEVERITY.ERROR,
    phases: [PHASE.INVOICE_CREATE, PHASE.INVOICE_APPROVE],
    evaluate: (ctx) => {
      const inv = ctx.invoice;
      if (!inv || ctx.allowMultiInvoicePerPl) return [];
      const dead = ['CANCELLED', 'SUPERSEDED'];
      return (inv.packingListRefs || [])
        .map((ref) => {
          const clash = (ctx.invoicesForPls || []).find((other) => other.id !== inv.id
            && !dead.includes(other.status)
            && (other.packingListRefs || []).some((r) => r.plId === ref.plId));
          if (!clash) return null;
          return finding(
            'V-16', SEVERITY.ERROR, 'This packing list is already invoiced',
            `${ref.plNo} is already on ${clash.invoiceNo || 'a draft invoice'}. Enable multiple invoices per packing list for this buyer, or cancel the other invoice.`,
            [{ type: 'PACKING_LIST', id: ref.plId, label: ref.plNo }],
            { plId: ref.plId, clashWith: clash.id },
          );
        })
        .filter(Boolean);
    },
  },
];

/** Order-vs-packed, computed once per validate() call and shared by V-04/05/09/15. */
const variance = (ctx) => {
  if (ctx.__variance) return ctx.__variance;
  const rows = orderVsPacked(ctx.orderBreakdown || [], allRows(ctx.pl), {
    tolerancePercent: ctx.tolerancePercent || 0,
    matchColour: ctx.matchColour,
  });
  // Cached on the context object so eight rules do not recompute the same pivot.
  Object.defineProperty(ctx, '__variance', { value: rows, enumerable: false });
  return rows;
};

// ─── Entry point ────────────────────────────────────────────────────────────────

/**
 * Run the catalogue for one phase.
 *
 * `ctx` carries everything a rule may read:
 *   { pl, plsInShipment, packedElsewhere, orderBreakdown, tolerancePercent,
 *     template, totals, matchColour }
 *
 * Returns the findings plus the two answers screens actually want: what is blocking,
 * and whether an authorised user may proceed.
 */
export const validate = (ctx, options = {}) => {
  const { phase = PHASE.SAVE, rules = RULES, acknowledgements = [] } = options;

  const findings = rules
    .filter((rule) => rule.phases.includes(phase))
    .flatMap((rule) => {
      const produced = rule.evaluate(ctx, phase) || [];
      return produced.map((item) => {
        const ack = (acknowledgements || []).find((a) => acknowledgementApplies(a, item));
        return ack ? { ...item, acknowledged: true, acknowledgement: ack } : item;
      });
    });

  const errors = findings.filter((f) => f.severity === SEVERITY.ERROR);
  const warnings = findings.filter((f) => f.severity === SEVERITY.WARN);
  const infos = findings.filter((f) => f.severity === SEVERITY.INFO);

  // BR-03: a warning never blocks an authorised user — it blocks an unacknowledged
  // one, and only where the PRD asks for a reason before moving the document on.
  const gatedPhase = phase === PHASE.SUBMIT || phase === PHASE.APPROVE
    || phase === PHASE.STICKER || phase === PHASE.DOC_GEN
    // The invoice's approval is a gate too. Leaving it out let an unacknowledged
    // warning through approval in silence — the one moment the PRD most wants a
    // reason on record (§14's closing requirement).
    || phase === PHASE.INVOICE_APPROVE;
  const unacknowledged = warnings.filter((w) => w.acknowledgeable && !w.acknowledged);
  const blocking = [...errors, ...(gatedPhase ? unacknowledged : [])];

  return {
    findings,
    errors,
    warnings,
    infos,
    unacknowledged,
    blocking,
    canProceed: blocking.length === 0,
  };
};

/** Build the record stored when a user acknowledges a warning (PRD §14 / §20). */
export const buildAcknowledgement = (item, reason, user, at) => ({
  code: item.code,
  targetKey: item.targetKey,
  values: item.values,
  reason,
  user,
  at,
});
