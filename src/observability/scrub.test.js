// What may reach Sentry: no bodies, cookies, secret headers or query strings, and the user as an id only.
//   npx vitest run src/observability/scrub.test.js
import { describe, test, expect } from 'vitest';
import { scrubBreadcrumb, scrubEvent, scrubRequest, scrubSpan, stripQuery, userById } from './scrub';

describe('stripQuery', () => {
  test('cuts the query string and the fragment, and leaves a URL without them alone', () => {
    expect(stripQuery('https://api.avarshai.com/api/v1/orders?search=ACME&page=0')).toBe('https://api.avarshai.com/api/v1/orders');
    expect(stripQuery('/orders/edit/12#lines')).toBe('/orders/edit/12');
    expect(stripQuery('/orders/list')).toBe('/orders/list');
  });

  test('anything that is not a string comes back as it was', () => {
    expect(stripQuery(undefined)).toBeUndefined();
    expect(stripQuery(42)).toBe(42);
  });
});

describe('scrubRequest', () => {
  test('drops the body, the cookies and the query string, and strips the URL', () => {
    const out = scrubRequest({
      url: 'https://app.avarshai.com/orders/list?search=Zara',
      query_string: 'search=Zara',
      data: { password: 'x' },
      cookies: { refresh: 'y' },
      method: 'GET',
    });
    expect(out).toEqual({ url: 'https://app.avarshai.com/orders/list', method: 'GET' });
  });

  test('drops authorization, cookie and token headers; keeps the rest, with the referrer stripped', () => {
    const out = scrubRequest({
      headers: {
        Authorization: 'Bearer abc',
        cookie: 'a=b',
        'X-Auth-Token': 't',
        'x-session-id': 's',
        'X-Api-Key': 'k',
        Referer: 'https://app.avarshai.com/po/list?status=DRAFT',
        'User-Agent': 'Chrome',
      },
    });
    expect(out.headers).toEqual({ Referer: 'https://app.avarshai.com/po/list', 'User-Agent': 'Chrome' });
  });

  test('nothing to scrub comes back as it was', () => {
    expect(scrubRequest(undefined)).toBeUndefined();
  });
});

describe('scrubBreadcrumb', () => {
  test('strips the URLs a fetch, xhr or navigation breadcrumb records', () => {
    expect(scrubBreadcrumb({ category: 'fetch', data: { method: 'GET', url: '/api/v1/items?q=thread', status_code: 200 } }))
      .toEqual({ category: 'fetch', data: { method: 'GET', url: '/api/v1/items', status_code: 200 } });
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } }).data).toEqual({ from: '/a', to: '/b' });
  });

  test('a breadcrumb without data is left as it is', () => {
    const crumb = { category: 'ui.click', message: 'button.ant-btn' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});

describe('the user', () => {
  test('a positive whole-number id is kept, as a string', () => {
    expect(userById(17)).toEqual({ id: '17' });
    expect(userById('17')).toEqual({ id: '17' });
  });

  test('a username, an email or no id at all sends no user', () => {
    ['ranjith', 'ranjith@avarsh.com', '', null, undefined, 0, -3, 1.5, true].forEach((id) => {
      expect(userById(id), String(id)).toBeUndefined();
    });
  });
});

describe('scrubEvent', () => {
  test('scrubs the request and the breadcrumbs, and replaces the user with the id alone', () => {
    const event = {
      message: 'boom',
      request: { url: 'https://app.avarshai.com/bom/list?style=ST-1', data: 'x' },
      breadcrumbs: [{ category: 'xhr', data: { url: '/api/v1/boms?style=ST-1' } }],
      user: { id: 17, email: 'a@b.c', username: 'ranjith', ip_address: '1.2.3.4' },
    };
    expect(scrubEvent(event, 17)).toEqual({
      message: 'boom',
      request: { url: 'https://app.avarshai.com/bom/list' },
      breadcrumbs: [{ category: 'xhr', data: { url: '/api/v1/boms' } }],
      user: { id: '17' },
    });
    // The event passed in is not changed
    expect(event.user.email).toBe('a@b.c');
  });

  test('without a usable id the user is removed', () => {
    expect(scrubEvent({ user: { username: 'ranjith' } }, 'ranjith')).toEqual({});
    expect(scrubEvent({ message: 'x' }, null)).toEqual({ message: 'x' });
  });
});

describe('scrubSpan', () => {
  test('a request span loses its query string from the description and its attributes', () => {
    const span = {
      op: 'http.client',
      description: 'GET https://api.avarshai.com/api/v1/orders?search=Zara',
      data: {
        url: 'https://api.avarshai.com/api/v1/orders?search=Zara',
        'http.url': 'https://api.avarshai.com/api/v1/orders?search=Zara',
        'http.query': '?search=Zara',
        'http.fragment': '#x',
        'http.method': 'GET',
      },
    };
    expect(scrubSpan(span)).toEqual({
      op: 'http.client',
      description: 'GET https://api.avarshai.com/api/v1/orders',
      data: {
        url: 'https://api.avarshai.com/api/v1/orders',
        'http.url': 'https://api.avarshai.com/api/v1/orders',
        'http.method': 'GET',
      },
    });
  });

  test('the description of a span that is not a request is left alone', () => {
    expect(scrubSpan({ op: 'ui.interaction.click', description: 'Save?' }).description).toBe('Save?');
  });
});
