/**
 * What the Cut Panel and Garment Process PO clients share: the page shape, query params, the swatches the
 * server does not keep, and the command helpers. Every command carries the version the screen read and answers
 * with the saved PO, which the screen adopts.
 */
import axiosInstance from '../../core/axiosInstance';
import { getColorHex } from '../../../utils/colorConstants';

export { toPage, listParams, toHistory } from '../../bom/requirementApi';

export const get = async (url, params) => (await axiosInstance.get(url, {
  params,
  // Several values of one filter (process=A&process=B), as the server binds a list
  paramsSerializer: { indexes: null },
})).data;
export const post = async (url, body, config) => (await axiosInstance.post(url, body, config)).data;
export const put = async (url, body) => (await axiosInstance.put(url, body)).data;
export const patch = async (url, body) => (await axiosInstance.patch(url, body)).data;

/**
 * A command whose 422 lists every blocking rule in `errors`: the screen shows them in its action bar
 * (useActionRunner), so the interceptor must not also toast the first one.
 */
export const checked = (url, body) => post(url, body, { silent: true });

/** Colour swatches come from the name-based colour map; the PO keeps colour names only. */
const swatch = (l) => ({ ...l, colorHex: getColorHex(l.colorName ?? l.color) });

export const withSwatches = (po) => po && ({
  ...po,
  lines: (po.lines || []).map(swatch),
  pendingRevision: po.pendingRevision ? { ...po.pendingRevision, lines: (po.pendingRevision.lines || []).map(swatch) } : po.pendingRevision,
});
