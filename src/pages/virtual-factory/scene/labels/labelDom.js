const GAP = 4;

/** A label's size before it has been measured. */
export const FALLBACK_SIZE = { w: 140, h: 36 };

/**
 * Screen space taken this frame, shared by every label layer: layers placed earlier in the scene
 * (alerts) win, a later label that would overlap is hidden for that frame instead of piling up.
 */
const taken = { at: -1, rects: [] };

/** Starts a frame's record of taken screen space; the first layer drawn in a frame clears it. */
export const beginFrame = (time) => {
  if (taken.at === time) return;
  taken.at = time;
  taken.rects = [];
};

const overlaps = (a, b) => !(a.x1 + GAP < b.x0 || a.x0 > b.x1 + GAP || a.y1 + GAP < b.y0 || a.y0 > b.y1 + GAP);

/** Claims a screen rectangle for this frame; false when a label already shown covers it. */
export const claim = (rect) => {
  if (taken.rects.some((r) => overlaps(rect, r))) return false;
  taken.rects.push(rect);
  return true;
};

/** Writes a label's title and optional detail into its element, as text only. */
export const fillLabel = (el, label) => {
  el.dataset.tone = label.tone || 'neutral';
  el.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = label.title || '';
  el.appendChild(title);
  if (label.text) {
    const text = document.createElement('span');
    text.textContent = label.text;
    el.appendChild(text);
  }
};

/** The element's rendered size, measured even while it is hidden. */
export const measure = (el) => {
  const shown = el.style.display;
  el.style.display = '';
  const size = { w: el.offsetWidth || FALLBACK_SIZE.w, h: el.offsetHeight || FALLBACK_SIZE.h };
  el.style.display = shown;
  return size;
};
