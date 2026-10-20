/**
 * The last query string of each server-paged list (page, sort, search, filters), kept for this tab.
 *
 * A form returns to its list by path (navigate('/orders/list')), which would open the list at page 1 with
 * no filters. `listPath('/orders/list')` gives the path with the query the list last had, so the user lands
 * where they left. A list opened from the menu uses the bare path and starts fresh, as before.
 */
const KEY = (path) => `erp:list:${path}`;

export const rememberListQuery = (path, search) => {
  try {
    if (search) window.sessionStorage.setItem(KEY(path), search);
    else window.sessionStorage.removeItem(KEY(path));
  } catch {
    // Storage unavailable: returning lands on the fresh list, as it always did.
  }
};

export const listPath = (path) => {
  try {
    const search = window.sessionStorage.getItem(KEY(path));
    return search ? `${path}${search.startsWith('?') ? '' : '?'}${search}` : path;
  } catch {
    return path;
  }
};
