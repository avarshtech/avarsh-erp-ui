/**
 * What the feedback widget records about the element a user picked: enough for a developer to find it
 * in the code (tag, id, classes, a CSS selector, its visible label) and nothing a user typed into it.
 */
import { redactText } from './redaction';

const MAX_TEXT = 200;
const MAX_CLASSES = 10;
const FORM_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const cssEscape = (value) =>
  (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));

/** Class names worth showing: not antd's generated css-in-js hashes. */
export function stableClasses(element) {
  const raw = typeof element.className === 'string' ? element.className : element.getAttribute?.('class') || '';
  return raw.split(/\s+/).filter((c) => c && !/^css-/.test(c)).slice(0, MAX_CLASSES);
}

/**
 * Visible text of the element, never a form field's value. Collapsed whitespace, trimmed to 200
 * characters, redacted.
 */
export function visibleText(element) {
  if (FORM_FIELDS.has(element.tagName) || element.isContentEditable) return '';
  const text = (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
  return redactText(text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);
}

/** A selector that finds the element again: its id if it has one, else a short nth-of-type path. */
export function buildSelector(element, maxDepth = 5) {
  const parts = [];
  let node = element;
  while (node && node.nodeType === 1 && parts.length < maxDepth) {
    const tag = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    const testId = node.getAttribute?.('data-testid');
    if (testId) {
      parts.unshift(`${tag}[data-testid="${testId}"]`);
      break;
    }
    let part = tag;
    const parent = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

export function describeElement(element) {
  const rect = element.getBoundingClientRect();
  const attr = (name) => element.getAttribute?.(name) || undefined;
  const metadata = {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classes: stableClasses(element),
    selector: buildSelector(element),
    text: visibleText(element) || undefined,
    role: attr('role'),
    ariaLabel: redactText(attr('aria-label') || attr('placeholder') || attr('title') || '') || undefined,
    name: attr('name'),
    type: FORM_FIELDS.has(element.tagName) ? attr('type') || element.tagName.toLowerCase() : undefined,
    dataTestId: attr('data-testid'),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
  return Object.fromEntries(Object.entries(metadata).filter(([, v]) => v !== undefined));
}
