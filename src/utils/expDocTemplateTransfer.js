/**
 * Template export / import as JSON (§10.3) — moving a layout between tenants or
 * handing it to support.
 *
 * The envelope is stamped so an import can refuse a shape it does not understand
 * rather than silently dropping half a layout. Format 2 adds the v2 layout keys
 * (column groups, sheet column sets, invoice boxes and columns, text blocks); format 1
 * files from the mock phase still import, since every v1 key is still read.
 */
import { LAYOUT_KEYS, pickLayout } from './expDocSystemTemplates';

export const TEMPLATE_FORMAT = 'avarsh.expdoc.template';
export const TEMPLATE_FORMAT_VERSION = 2;

export const toExportEnvelope = (template) => ({
  _format: TEMPLATE_FORMAT,
  _formatVersion: TEMPLATE_FORMAT_VERSION,
  _exportedFrom: { templateCode: template.templateCode, version: template.version, status: template.status },
  template: {
    templateCode: template.templateCode,
    name: template.name,
    docType: template.docType,
    subClientCode: template.subClientCode || null,
    ...pickLayout(template),
    ...(template.stickerLayout ? { stickerLayout: template.stickerLayout } : {}),
  },
});

/** Throws with a user-facing message when the text is not a template export. */
export const parseImportEnvelope = (json) => {
  let parsed = json;
  if (typeof json === 'string') {
    try { parsed = JSON.parse(json); } catch { throw new Error('That is not valid JSON.'); }
  }
  if (parsed?._format !== TEMPLATE_FORMAT) {
    throw new Error('This file is not an Avarsh document template export.');
  }
  if (![1, 2].includes(Number(parsed._formatVersion))) {
    throw new Error(`Unsupported template format version ${parsed._formatVersion}.`);
  }
  const body = parsed.template || {};
  if (!body.docType) throw new Error('The imported template has no document type.');
  const layout = LAYOUT_KEYS.reduce((acc, key) => {
    if (body[key] !== undefined) acc[key] = body[key];
    return acc;
  }, {});
  return {
    templateCode: body.templateCode || '',
    name: body.name || '',
    docType: body.docType,
    subClientCode: body.subClientCode || null,
    stickerLayout: body.stickerLayout || null,
    layout,
    exportedFrom: parsed._exportedFrom || null,
  };
};
