// Golden tests: how a screen words an error and whether it toasts it (2026-10-14).
//   npx vitest run src/utils/apiError.test.js
import { describe, test, expect, vi } from 'vitest';
import { errorText, toastUnlessHandled } from './apiError';

describe('errorText', () => {
  test('the server text first, then the local message, then the fallback', () => {
    expect(errorText({ errorMessage: 'PO is locked', message: 'Request failed with status code 409' })).toBe('PO is locked');
    expect(errorText(new Error('Mock store is full'))).toBe('Mock store is full');
    expect(errorText({}, 'Could not save the PO')).toBe('Could not save the PO');
    expect(errorText(null)).toBe('Something went wrong');
    expect(errorText(undefined, 'x')).toBe('x');
  });

  test('an empty server text falls through to the next one', () => {
    expect(errorText({ errorMessage: '', message: 'Network Error' })).toBe('Network Error');
  });
});

describe('toastUnlessHandled', () => {
  test('an error the axios interceptor already toasted is not toasted again', () => {
    const message = { error: vi.fn() };
    toastUnlessHandled(message, { errorMessage: 'PO is locked' });
    expect(message.error).not.toHaveBeenCalled();
  });

  test('any other error is toasted once, worded by errorText', () => {
    const message = { error: vi.fn() };
    toastUnlessHandled(message, new Error('Mock store is full'));
    toastUnlessHandled(message, undefined, 'Could not load the list');
    expect(message.error.mock.calls).toEqual([['Mock store is full'], ['Could not load the list']]);
  });
});
