/**
 * Where bug reports go: the issue service on Cloud Run. (bugapi.avarshai.com points at the same service;
 * switch to https://bugapi.avarshai.com/api/v1 once its certificate is issued.) A build can send them elsewhere with
 * VITE_FEEDBACK_API_URL, or hide the widget by setting it to an empty value (the e2e mode does, see
 * .env.e2e). Kept free of imports so the launcher and main.jsx can read it without pulling in axios.
 */
export const DEFAULT_FEEDBACK_API_URL = 'https://avarsh-bugfix.cloud.run/api/v1';

export const FEEDBACK_API_URL = import.meta.env.VITE_FEEDBACK_API_URL ?? DEFAULT_FEEDBACK_API_URL;

/** The widget is shown only where an issue service is configured. */
export const isFeedbackConfigured = () => Boolean(FEEDBACK_API_URL);
