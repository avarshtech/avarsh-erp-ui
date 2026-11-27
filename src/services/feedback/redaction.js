/**
 * Redaction for everything the feedback widget captures automatically (element text, console errors,
 * page URL). The issue service redacts again on arrival; this layer means the data never leaves the
 * browser in the first place.
 *
 * Extend the rules for a deployment with configureRedaction({ extraPatterns, extraSensitiveKeys }).
 */

const DEFAULT_SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'authorization', 'cookie', 'session',
  'apikey', 'api_key', 'api-key', 'credential', 'privatekey', 'private_key', 'otp', 'cvv',
];

const DEFAULT_PATTERNS = [
  { pattern: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, replacement: '[REDACTED_JWT]' },
  { pattern: /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: '$1 [REDACTED]' },
  {
    pattern: /([?&#](?:access_token|id_token|refresh_token|token|code|password|pwd|secret|key|api_key|apikey|session|sig|signature)=)[^&#\s]*/gi,
    replacement: '$1[REDACTED]',
  },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
];

const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

let sensitiveKeys = [...DEFAULT_SENSITIVE_KEYS];
let patterns = [...DEFAULT_PATTERNS];

/** Adds deployment-specific rules on top of the defaults (never removes a default). */
export function configureRedaction({ extraPatterns = [], extraSensitiveKeys = [] } = {}) {
  sensitiveKeys = [...DEFAULT_SENSITIVE_KEYS, ...extraSensitiveKeys.map((k) => k.toLowerCase())];
  patterns = [...DEFAULT_PATTERNS, ...extraPatterns];
}

/** Restores the defaults (tests). */
export function resetRedaction() {
  sensitiveKeys = [...DEFAULT_SENSITIVE_KEYS];
  patterns = [...DEFAULT_PATTERNS];
}

export function isSensitiveKey(key) {
  const normalised = String(key).toLowerCase();
  return sensitiveKeys.some((sensitive) => normalised.includes(sensitive));
}

export function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Only digit runs that pass the Luhn check, so PO numbers, phone numbers and timestamps survive. */
function redactCardNumbers(text) {
  return text.replace(CARD_CANDIDATE, (match) => {
    const digits = match.replace(/[ -]/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhnValid(digits) ? '[REDACTED_NUMBER]' : match;
  });
}

export function redactText(text) {
  if (typeof text !== 'string' || text === '') return text;
  let out = text;
  for (const { pattern, replacement } of patterns) {
    out = out.replace(pattern, replacement);
  }
  return redactCardNumbers(out);
}

/** Deep copy with sensitive keys replaced and every string redacted. */
export function redactValue(value, depth = 0) {
  if (typeof value === 'string') return redactText(value);
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? '[REDACTED]' : redactValue(item, depth + 1);
  }
  return out;
}
