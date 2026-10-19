import { documentShell, esc, escAttr, openPrintWindow, pageCss } from './printDoc';
import { assetLabelUrl, qrSvg } from './qrSvg';

/**
 * The sticker that goes on the machine.
 *
 * Two stocks, both from the PRD appendix. One label per page, which is what a
 * thermal label printer wants: the roll advances one label at a time, and an
 * A4-sheet grid would waste most of a roll. `pageCss` still sets the grid so a
 * future sheet layout needs no new mechanism.
 *
 * The QR encodes the asset's URL, not a bare id - scanning it with a phone
 * camera opens the asset. The code is also printed as text underneath the ID,
 * because the one thing certain about a label on a sewing machine is that it
 * will be scuffed, and a person can still read and type the number.
 */
export const LABEL_STOCKS = {
  SMALL: { key: 'SMALL', label: '50 x 25 mm', widthMm: 50, heightMm: 25, qrPx: 150, compact: true },
  LARGE: { key: 'LARGE', label: '70 x 40 mm', widthMm: 70, heightMm: 40, qrPx: 190, compact: false },
};

const css = (stock) => `
  ${pageCss({ widthMm: stock.widthMm, heightMm: stock.heightMm })}
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label {
    display: flex; align-items: stretch; gap: ${stock.compact ? 1.2 : 2}mm;
    padding: ${stock.compact ? 1.2 : 2}mm; height: 100%; width: 100%;
  }
  .text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .qr { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .qr svg { width: ${stock.compact ? 15 : 22}mm; height: ${stock.compact ? 15 : 22}mm; display: block; }
  .company {
    font-size: ${stock.compact ? 5 : 7}pt; font-weight: 700; letter-spacing: 0.2px;
    text-transform: uppercase; border-bottom: 0.4mm solid #000;
    padding-bottom: 0.3mm; margin-bottom: ${stock.compact ? 0.5 : 1}mm;
  }
  /* The asset ID is the whole point of the label, so it gets the space. */
  .code { font-size: ${stock.compact ? 9 : 13}pt; font-weight: 800; line-height: 1.05; letter-spacing: -0.2px; }
  .name { font-size: ${stock.compact ? 5.5 : 7.5}pt; font-weight: 600; line-height: 1.15; margin-top: 0.4mm; }
  .spec { font-size: ${stock.compact ? 5 : 6.5}pt; line-height: 1.2; margin-top: 0.3mm; }
  .unit { font-size: ${stock.compact ? 5 : 6.5}pt; font-weight: 700; margin-top: 0.3mm; }
  /* Long machine names wrap to two lines and then stop, rather than pushing
     the unit off a 25mm label. */
  .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
`;

/** "U1 / Sewing / Overlock" - as much of the path as the stock has room for. */
const placeOf = (asset, stock) => [asset.unitName, asset.departmentName, stock.compact ? null : asset.sectionName]
  .filter(Boolean).join(' / ');

const labelHtml = (asset, stock, companyName) => {
  const specs = [asset.model && `Model ${asset.model}`, asset.serialNo && `SL ${asset.serialNo}`]
    .filter(Boolean).join('  ');
  return `
  <div class="label">
    <div class="text">
      ${companyName ? `<div class="company">${esc(companyName)}</div>` : ''}
      <div class="code">${esc(asset.assetId)}</div>
      <div class="name clamp">${esc(asset.name)}</div>
      ${specs ? `<div class="spec clamp">${esc(specs)}</div>` : ''}
      ${placeOf(asset, stock) ? `<div class="unit">${esc(placeOf(asset, stock))}</div>` : ''}
    </div>
    <div class="qr" title="${escAttr(assetLabelUrl(asset.assetId))}">
      ${qrSvg(assetLabelUrl(asset.assetId), { sizePx: stock.qrPx })}
    </div>
  </div>`;
};

/**
 * Prints one label per asset, `copies` times each.
 *
 * Copies are grouped per asset rather than interleaved: whoever is sticking
 * them walks to one machine with its two labels in hand.
 *
 * Returns false when the pop-up was blocked, so the caller can say so.
 */
export const printAssetLabels = (assets, { stock = LABEL_STOCKS.LARGE, copies = 1, companyName = '' } = {}) => {
  const rows = (Array.isArray(assets) ? assets : [assets]).filter(Boolean);
  if (!rows.length) return false;

  const sheets = rows.flatMap((asset) => Array.from({ length: Math.max(1, copies) },
    () => `<div class="sheet">${labelHtml(asset, stock, companyName)}</div>`)).join('');

  return openPrintWindow(documentShell({
    title: rows.length === 1 ? `Label_${rows[0].assetId}` : `Asset_Labels_${rows.length}`,
    bodyCss: css(stock),
    body: sheets,
  }));
};
