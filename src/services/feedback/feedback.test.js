import { afterEach, describe, expect, test } from 'vitest';
import { configureRedaction, isSensitiveKey, redactText, redactValue, resetRedaction } from './redaction';
import {
  MAX_API_FAILURES, MAX_CONSOLE_ENTRIES, formatConsoleArgs, getDiagnostics, pushBounded,
  recordApiFailure, recordConsoleError, resetDiagnostics, toPathTemplate,
} from './diagnostics';
import { buildIssuePayload, parseUserAgent, resolveModule } from './captureContext';
import { detectBuildEnvironment, environmentFields, normaliseEnvironment } from './environment';
import { buildSelector, describeElement, stableClasses, visibleText } from './elementMetadata';
import { describeSubmitError } from './feedbackApi';
import { findScreenByPath } from '../../utils/permissions';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.c2lnbmF0dXJlLWJ5dGVz';

afterEach(() => {
  resetDiagnostics();
  resetRedaction();
});

describe('redaction', () => {
  test('removes tokens, bearer headers, URL secrets and e-mails', () => {
    const out = redactText(`t=${JWT} Authorization: Bearer abcdefgh12345678 https://x/y?token=s3cr3t&page=2 mail a.b@c.com`);
    expect(out).not.toContain(JWT);
    expect(out).not.toContain('abcdefgh12345678');
    expect(out).not.toContain('s3cr3t');
    expect(out).not.toContain('a.b@c.com');
    expect(out).toContain('page=2');
  });

  test('redacts only Luhn-valid card numbers, so PO numbers and timestamps survive', () => {
    const out = redactText('card 4111 1111 1111 1111 po 1732790400000 phone 9876543210');
    expect(out).toContain('[REDACTED_NUMBER]');
    expect(out).toContain('1732790400000');
    expect(out).toContain('9876543210');
  });

  test('drops values under sensitive keys at any depth', () => {
    const out = redactValue({ user: { name: 'A', accessToken: 'x', nested: { password: 'p' } } });
    expect(out).toEqual({ user: { name: 'A', accessToken: '[REDACTED]', nested: { password: '[REDACTED]' } } });
  });

  test('extra rules can be added for a deployment', () => {
    configureRedaction({ extraPatterns: [{ pattern: /GSTIN\w+/g, replacement: '[GSTIN]' }], extraSensitiveKeys: ['pan'] });
    expect(redactText('GSTIN27ABCDE')).toBe('[GSTIN]');
    expect(isSensitiveKey('panNumber')).toBe(true);
  });
});

describe('diagnostics buffers', () => {
  test('pushBounded keeps the newest entries', () => {
    expect(pushBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  test('console errors are redacted, de-duplicated and bounded', () => {
    recordConsoleError('error', [new Error(`boom ${JWT}`)]);
    recordConsoleError('error', [new Error(`boom ${JWT}`)]);
    const [entry] = getDiagnostics().consoleErrors;
    expect(entry.message).toBe('Error: boom [REDACTED_JWT]');
    expect(entry.count).toBe(2);
    expect(entry.stack).not.toContain(JWT);

    for (let i = 0; i < MAX_CONSOLE_ENTRIES + 5; i += 1) recordConsoleError('error', [`error ${i}`]);
    const all = getDiagnostics().consoleErrors;
    expect(all).toHaveLength(MAX_CONSOLE_ENTRIES);
    expect(all.at(-1).message).toBe(`error ${MAX_CONSOLE_ENTRIES + 4}`);
  });

  test('formatConsoleArgs joins strings, objects and errors', () => {
    expect(formatConsoleArgs(['Failed', { status: 500 }]).message).toBe('Failed {"status":500}');
  });

  test('API paths keep their shape but lose ids, queries and the host', () => {
    expect(toPathTemplate('/purchase-orders/42?status=OPEN', 'http://localhost:8080/api/v1'))
      .toBe('/api/v1/purchase-orders/:id');
    expect(toPathTemplate('https://api.x.com/api/v1/items/3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f/files'))
      .toBe('/api/v1/items/:id/files');
    expect(toPathTemplate('/orders/edit', '/api/v1')).toBe('/api/v1/orders/edit');
  });

  test('API failures keep metadata only, bounded', () => {
    for (let i = 0; i < MAX_API_FAILURES + 2; i += 1) {
      recordApiFailure({ method: 'put', url: `/orders/${i}`, baseURL: '/api/v1', status: 500, durationMs: 12.6,
        traceId: 'abc', errorCode: 'RULE_VIOLATION' });
    }
    const failures = getDiagnostics().apiFailures;
    expect(failures).toHaveLength(MAX_API_FAILURES);
    expect(failures[0]).toMatchObject({ method: 'PUT', path: '/api/v1/orders/:id', status: 500, durationMs: 13,
      traceId: 'abc', errorCode: 'RULE_VIOLATION' });
    expect(Object.keys(failures[0]).sort()).toEqual(
      ['durationMs', 'errorCode', 'method', 'path', 'status', 'timestamp', 'traceId']);
  });

  test('a network failure is recorded with status 0', () => {
    recordApiFailure({ method: 'get', url: '/x', baseURL: '' });
    expect(getDiagnostics().apiFailures[0]).toMatchObject({ status: 0, statusText: 'Network error' });
  });
});

describe('context', () => {
  test('parses common browsers and systems', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'))
      .toEqual({ browserName: 'Chrome', browserVersion: '131.0.0.0', os: 'Windows', osVersion: '10.0' });
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0.2903.70').browserName)
      .toBe('Edge');
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'))
      .toMatchObject({ browserName: 'Safari', os: 'iOS', osVersion: '17.4' });
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'))
      .toMatchObject({ browserName: 'Firefox', os: 'Linux' });
  });

  test('a route resolves to its screen and menu section', () => {
    expect(findScreenByPath('/orders/edit/42')?.id).toBe('orders');
    expect(findScreenByPath('/bom/cut-panel/7')?.id).toBe('cut-panel');
    expect(findScreenByPath('/no/such/screen')).toBeNull();
    expect(resolveModule('/orders/edit/42')).toEqual({ module: 'orders', moduleSection: 'Orders' });
    expect(resolveModule('/no/such/screen')).toEqual({ module: 'no', moduleSection: undefined });
  });
});

/** Just enough of an Element for the metadata helpers. */
function fakeElement({ tag = 'DIV', id = '', className = '', text = '', attrs = {}, parent = null } = {}) {
  const el = {
    nodeType: 1, tagName: tag, id, className, innerText: text, parentElement: parent, children: [],
    getAttribute: (name) => attrs[name] ?? null,
    getBoundingClientRect: () => ({ x: 10.4, y: 20.6, width: 100, height: 32 }),
  };
  if (parent) parent.children.push(el);
  return el;
}

describe('element metadata', () => {
  test('never keeps what was typed into a field', () => {
    const input = fakeElement({ tag: 'INPUT', id: 'po-total', attrs: { type: 'text', placeholder: 'Total', name: 'total' } });
    input.value = 'secret typed value';
    const meta = describeElement(input);
    expect(JSON.stringify(meta)).not.toContain('secret typed value');
    expect(meta).toMatchObject({ tag: 'input', id: 'po-total', selector: '#po-total', type: 'text', name: 'total',
      ariaLabel: 'Total', rect: { x: 10, y: 21, width: 100, height: 32 } });
  });

  test('visible text is collapsed, trimmed and redacted', () => {
    expect(visibleText(fakeElement({ text: '  Save\n\n  order  for a@b.com ' }))).toBe('Save order for [REDACTED_EMAIL]');
    expect(visibleText(fakeElement({ text: 'x'.repeat(300) }))).toHaveLength(201);
  });

  test('generated css-in-js classes are left out', () => {
    expect(stableClasses(fakeElement({ className: 'ant-btn css-dev-only-do-not-override-abc ant-btn-primary' })))
      .toEqual(['ant-btn', 'ant-btn-primary']);
  });

  test('the selector stops at the nearest id', () => {
    const root = fakeElement({ id: 'main-content' });
    const row = fakeElement({ tag: 'DIV', parent: root });
    fakeElement({ tag: 'BUTTON', parent: row });
    const second = fakeElement({ tag: 'BUTTON', parent: row });
    expect(buildSelector(second)).toBe('#main-content > div > button:nth-of-type(2)');
  });
});

describe('submit errors', () => {
  test('each failure gets a message the user can act on', () => {
    expect(describeSubmitError({ response: { status: 503, data: { error: 'FEEDBACK_NOT_CONFIGURED' } } }))
      .toMatch(/not set up/);
    expect(describeSubmitError({ response: { status: 429, data: {} } })).toMatch(/try again later/);
    expect(describeSubmitError({ response: { status: 413, data: {} } })).toMatch(/too large/);
    expect(describeSubmitError({ isOfflineError: true })).toMatch(/offline/);
    expect(describeSubmitError({ message: 'Network Error' })).toMatch(/Could not reach/);
    expect(describeSubmitError({ response: { status: 400, data: { error: 'VALIDATION_FAILED', fieldErrors: { environment: 'x' } } } }))
      .toMatch(/environment/);
  });
});

describe('environment', () => {
  test('build and profile names map to the names the ERP and the issue service use', () => {
    expect(normaliseEnvironment('production')).toBe('PROD');
    expect(normaliseEnvironment('PROD')).toBe('PROD');
    expect(normaliseEnvironment('qa')).toBe('QA');
    expect(normaliseEnvironment('development')).toBe('DEV');
    expect(normaliseEnvironment(' dev ')).toBe('DEV');
    expect(normaliseEnvironment('local')).toBe('LOCAL');
    expect(normaliseEnvironment('e2e')).toBe('TEST');
    expect(normaliseEnvironment('e2e-pg')).toBe('TEST');
    expect(normaliseEnvironment('staging')).toBeNull();
    expect(normaliseEnvironment(undefined)).toBeNull();
    expect(detectBuildEnvironment('qa')).toBe('QA');
    expect(detectBuildEnvironment('')).toBeNull();
  });

  test('the ERP server decides when it can; otherwise the form value is labelled by where it came from', () => {
    expect(environmentFields({ serverEnvironment: 'QA', buildEnvironment: 'DEV', chosen: 'PROD' })).toEqual({});
    expect(environmentFields({ serverEnvironment: null, buildEnvironment: 'DEV', chosen: 'DEV' }))
      .toEqual({ environment: 'DEV', environmentSource: 'APP_BUILD' });
    expect(environmentFields({ serverEnvironment: null, buildEnvironment: 'DEV', chosen: 'PROD' }))
      .toEqual({ environment: 'PROD', environmentSource: 'REPORTER' });
    expect(environmentFields({ serverEnvironment: null, buildEnvironment: null, chosen: 'QA' }))
      .toEqual({ environment: 'QA', environmentSource: 'REPORTER' });
    expect(environmentFields({ serverEnvironment: null, buildEnvironment: null, chosen: undefined })).toEqual({});
  });

  test('the submission carries the environment fields and a typed contact, trimmed', () => {
    const win = { navigator: { userAgent: '' }, screen: {}, innerWidth: 1280, innerHeight: 720 };
    const location = { pathname: '/orders', href: 'http://localhost/orders' };
    const values = {
      type: 'BUG', title: ' T ', description: ' D ', priority: 'HIGH', environment: 'PROD', reporterContact: '  98765 43210 ',
    };

    const chosen = buildIssuePayload({ values, environment: { serverEnvironment: null, buildEnvironment: 'DEV' }, location, win });
    expect(chosen).toMatchObject({ environment: 'PROD', environmentSource: 'REPORTER', reporterContact: '98765 43210' });

    const fromServer = buildIssuePayload({
      values: { ...values, reporterContact: '   ' }, environment: { serverEnvironment: 'QA', buildEnvironment: 'DEV' }, location, win,
    });
    expect(fromServer.environment).toBeUndefined();
    expect(fromServer.environmentSource).toBeUndefined();
    expect(fromServer.reporterContact).toBeUndefined();
  });
});
