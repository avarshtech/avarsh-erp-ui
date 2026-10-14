import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

/**
 * A QR code as an SVG string, for the HTML-string print pipeline.
 *
 * Every document in this folder is built as HTML text and handed to
 * `openPrintWindow`, which has none of the app's React tree. So the code is
 * rendered to static markup here rather than mounted as a component: one call,
 * a string of SVG, and the label templates stay plain strings like all the
 * others.
 *
 * SVG rather than canvas for the same reason `barcode1d.js` chose it - these
 * are printed, and vectors stay crisp at any DPI. `barcode1d` left QR alone
 * because a correct encoder needs Reed-Solomon and mask evaluation; this is
 * that encoder, from the library, rather than a second hand-rolled one.
 */
export const qrSvg = (value, { sizePx = 120, level = 'M', margin = false } = {}) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return renderToStaticMarkup(createElement(QRCodeSVG, {
    value: text,
    size: sizePx,
    level,
    // Error correction M survives a scuffed sticker on a machine; the quiet
    // zone is off by default because the label template already pads it, and
    // doubling the margin shrinks the modules on a 50mm label.
    marginSize: margin ? 2 : 0,
    bgColor: '#ffffff',
    fgColor: '#000000',
  }));
};

/**
 * What a scanned asset label opens.
 *
 * The URL carries the printed asset ID rather than a database id: the number on
 * the sticker is the thing a person can read aloud and type in when the label
 * is too scuffed to scan, so the two routes into an asset stay the same string.
 */
export const assetLabelUrl = (assetCode) => `${window.location.origin}/assets/code/${encodeURIComponent(assetCode)}`;
