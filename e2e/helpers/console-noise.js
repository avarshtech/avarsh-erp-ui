/**
 * Console output that does not come from the screen under test, so a console check ignores it:
 * the dev server does not serve the service worker, a failed request is the network's report
 * (the screen's handling of it is what counts), and React's DevTools advert.
 *
 * Shared by the route sweep and the consoleGuard fixture so the two can never disagree.
 */
export const CONSOLE_NOISE = [
  /Service worker registration failed/i,
  /unsupported MIME type/i,
  /Failed to load resource/i,
  /React DevTools/i,
];

/** True when a console message is noise rather than a problem. */
export const isConsoleNoise = (text) => CONSOLE_NOISE.some((pattern) => pattern.test(text));
