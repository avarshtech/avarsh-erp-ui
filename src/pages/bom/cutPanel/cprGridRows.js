import { calcRequiredQty } from '../../../utils/cutPanelCalc';

const groupKeyOf = (l) => `${l.fabricId}|${l.colorName}`;

/**
 * Grid rows grouped by fabric + colour (PRD §8.3): a header row, a grey reference row
 * with the colour's order qty per size, then the lines ordered by panel and sequence.
 * Collapsed groups show only their header.
 */
export const buildGridRows = (lines, order, allowancePct, collapsed) => {
  const colourRank = Object.fromEntries(order.colors.map((c, i) => [c.name, i]));
  const groups = {};
  lines.forEach((l) => { (groups[groupKeyOf(l)] ||= []).push(l); });
  return Object.entries(groups)
    .sort(([, a], [, b]) => a[0].fabricName.localeCompare(b[0].fabricName) || colourRank[a[0].colorName] - colourRank[b[0].colorName])
    .flatMap(([gk, ls]) => {
      const first = ls[0];
      const color = order.colors.find((c) => c.name === first.colorName) || { name: first.colorName };
      const header = {
        type: 'group', key: `g:${gk}`, gk, fabricName: first.fabricName, fabricCode: first.fabricCode, color,
        lineCount: ls.length, orderQty: color.qty || 0, orderQtyAllow: calcRequiredQty(color.qty || 0, 1, allowancePct),
      };
      if (collapsed.has(gk)) return [header];
      const sorted = [...ls].sort((a, b) => a.panelName.localeCompare(b.panelName) || a.sequenceNo - b.sequenceNo);
      return [header, { type: 'ref', key: `r:${gk}`, gk, base: order.qtyMatrix[first.colorName] || {} }, ...sorted.map((l) => ({ ...l, type: 'line' }))];
    });
};
