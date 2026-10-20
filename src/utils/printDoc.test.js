// Golden tests: the print helpers every document generator shares, as they behave today
// (2026-10-12). The three escapers differ on purpose, and print layouts depend on the difference.
//   npx vitest run src/utils/printDoc.test.js
import { afterEach, describe, test, expect, vi } from 'vitest';
import {
  cell, documentFileName, documentShell, draftWatermarkCss, esc, escAttr, escInline, openPrintWindow,
  pageCss, watermarkCss,
} from './printDoc';

const XSS = '<img src=x onerror=alert(1)>';

describe('esc: text content, newlines become <br/>', () => {
  test('escapes &, < and > (ampersand first, so nothing is escaped twice), and keeps quotes', () => {
    expect(esc('<b>Tom & "Jerry"</b>')).toBe('&lt;b&gt;Tom &amp; "Jerry"&lt;/b&gt;');
    expect(esc('&lt;')).toBe('&amp;lt;');
    expect(esc(XSS)).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('every newline becomes a <br/>; a carriage return stays as it is', () => {
    expect(esc('Plot 12\nTiruppur')).toBe('Plot 12<br/>Tiruppur');
    expect(esc('a\n\nb')).toBe('a<br/><br/>b');
    expect(esc('a\r\nb')).toBe('a\r<br/>b');
  });

  test('null and undefined print nothing; numbers print as text', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(0)).toBe('0');
    expect(esc(12.5)).toBe('12.5');
  });
});

describe('escInline: text content, newlines left alone', () => {
  test('escapes like esc, but a multi-line value stays one run of text (the PO and order prints)', () => {
    expect(escInline('<i>x</i>\ny & z')).toBe('&lt;i&gt;x&lt;/i&gt;\ny &amp; z');
    expect(escInline(XSS)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escInline(null)).toBe('');
  });
});

describe('escAttr: attribute values', () => {
  test('also escapes double and single quotes, so a value cannot leave its attribute', () => {
    expect(escAttr('"><script>alert(\'x\')</script>')).toBe('&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  });

  test('never injects <br/>: a newline stays a newline', () => {
    expect(escAttr('a\nb')).toBe('a\nb');
    expect(escAttr(undefined)).toBe('');
  });
});

describe('cell: a labelled box of the bordered export header grid', () => {
  test('the exact markup, with the value escaped and its newlines broken', () => {
    expect(cell('Invoice No', 'INV/1\nRev 2')).toBe([
      '',
      '  <td colspan="1" style="border:1px solid #333;padding:4px 6px;vertical-align:top;">',
      '    <div style="font-size:8px;color:#555;font-style:italic;">Invoice No</div>',
      '    <div style="font-size:10px;font-weight:400;white-space:pre-wrap;">INV/1<br/>Rev 2</div>',
      '  </td>',
    ].join('\n'));
  });

  test('an empty value shows a dash, a zero shows 0; colspan, bold and extra style apply', () => {
    expect(cell('Weight', '')).toContain('>&mdash;</div>');
    expect(cell('Weight', null)).toContain('>&mdash;</div>');
    expect(cell('Cartons', 0)).toContain('>0</div>');
    const wide = cell('<Label>', 'x', { colspan: 2, bold: true, style: 'width:50%;' });
    expect(wide).toContain('<td colspan="2" style="border:1px solid #333;padding:4px 6px;vertical-align:top;width:50%;">');
    expect(wide).toContain('font-weight:700;');
    expect(wide).toContain('>&lt;Label&gt;</div>');
  });
});

describe('the document shell and its watermark', () => {
  test('escapes the title and inserts the body as built', () => {
    const html = documentShell({ title: 'PO <1>', body: '<p>x</p>' });
    expect(html.startsWith('<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8" />\n  <title>PO &lt;1&gt;</title>')).toBe(true);
    expect(html.endsWith('<body><p>x</p></body>\n</html>')).toBe(true);
    expect(html).not.toContain('body::before');
  });

  test('a draft carries the DRAFT band; a named watermark replaces it', () => {
    expect(documentShell({ title: 't', body: '', draft: true })).toContain(draftWatermarkCss);
    const cancelled = documentShell({ title: 't', body: '', draft: true, watermark: 'CANCELLED' });
    expect(cancelled).toContain("content: 'CANCELLED';");
    expect(cancelled).not.toContain("content: 'DRAFT';");
  });

  test('the band drops quotes from its text and shrinks for long words', () => {
    expect(watermarkCss("O'Brien")).toContain("content: 'OBrien';");
    expect(watermarkCss('DRAFT')).toContain('font-size: 120px;');
    expect(watermarkCss('SUPERSEDED')).toContain('font-size: 84px;');
  });

  test('page CSS sets the paper and the label grid', () => {
    const css = pageCss({ widthMm: 100, heightMm: 150, cols: 2, rows: 3 });
    expect(css).toContain('@page { size: 100mm 150mm; margin: 0mm; }');
    expect(css).toContain('grid-template-columns: repeat(2, 1fr);');
    expect(css).toContain('grid-template-rows: repeat(3, 1fr);');
  });
});

describe('documentFileName: {DocType}_{Buyer}_{No}_{Version}.{ext}', () => {
  test('anything but letters, digits, _ and - becomes one dash, trimmed at the ends', () => {
    expect(documentFileName({ docType: 'Packing List', buyer: 'Zara (Inditex)', docNo: 'PKL/26-27/1001', version: 2 }))
      .toBe('Packing-List_Zara-Inditex_PKL-26-27-1001_v2.pdf');
  });

  test('a missing part is left out; version 0 still prints; the extension can change', () => {
    expect(documentFileName({ docType: 'Invoice', docNo: '7' })).toBe('Invoice_7.pdf');
    expect(documentFileName({ docType: 'Invoice', docNo: '7', version: 0, ext: 'html' })).toBe('Invoice_7_v0.html');
  });
});

describe('openPrintWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('returns false when the browser blocks the pop-up', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    expect(openPrintWindow('<p>x</p>')).toBe(false);
  });

  test('writes the document, closes it, and prints once it has loaded and the delay has passed', () => {
    vi.useFakeTimers();
    const printWindow = { document: { write: vi.fn(), close: vi.fn() }, print: vi.fn() };
    const open = vi.fn(() => printWindow);
    vi.stubGlobal('window', { open });

    expect(openPrintWindow('<p>x</p>', { delayMs: 250 })).toBe(true);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(printWindow.document.write).toHaveBeenCalledWith('<p>x</p>');
    expect(printWindow.document.close).toHaveBeenCalled();

    printWindow.onload();
    vi.advanceTimersByTime(249);
    expect(printWindow.print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(printWindow.print).toHaveBeenCalledTimes(1);
  });
});
