/**
 * Where bug reports go: the issue service at bugapi.avarshai.com. A build can send them elsewhere with
 * VITE_FEEDBACK_API_URL, or hide the widget by setting it to an empty value (the e2e mode does, see
 * .env.e2e). Kept free of imports so the launcher and main.jsx can read it without pulling in axios.
 */
export const DEFAULT_FEEDBACK_API_URL = 'https://bugapi.avarshai.com/api/v1';

export const FEEDBACK_API_URL = import.meta.env.VITE_FEEDBACK_API_URL ?? DEFAULT_FEEDBACK_API_URL;

/** The widget is shown only where an issue service is configured. */
export const isFeedbackConfigured = () => Boolean(FEEDBACK_API_URL);
