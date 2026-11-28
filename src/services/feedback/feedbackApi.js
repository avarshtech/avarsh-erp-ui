/**
 * Sending a report: a reporter token from the ERP API, then the report to the separate issue service.
 *
 * The issue service gets its own axios client with no interceptors and no cookies: the ERP's client
 * would attach the ERP session token (which must never leave the ERP) and show its error toasts.
 */
import axios from 'axios';
import axiosInstance from '../core/axiosInstance';

const FEEDBACK_API_URL = import.meta.env.VITE_FEEDBACK_API_URL;

/** The widget is shown only where an issue service is configured. */
export const isFeedbackConfigured = () => Boolean(FEEDBACK_API_URL);

const issueClient = axios.create({
  baseURL: FEEDBACK_API_URL,
  timeout: 60000,
  withCredentials: false,
});

async function fetchReporterSession() {
  const { data } = await axiosInstance.post('/feedback/token', null, { silent: true, feedbackIgnore: true });
  return data;
}

/**
 * Who the report will be filed as and which environment the ERP server says it is, for the dialog to
 * show. The token in the same answer is discarded: submitting always asks for a fresh one, so a report
 * can never go out under a previous user's token.
 * @returns {Promise<{environment: string|null, reporter: {userId, username, name, email, role}|null}>}
 */
export async function loadReporterDetails() {
  const data = await fetchReporterSession();
  return { environment: data?.environment || null, reporter: data?.reporter || null };
}

async function fetchReporterToken() {
  return (await fetchReporterSession()).token;
}

const extensionFor = (blob) => (blob.type === 'image/jpeg' ? 'jpg' : 'png');

/**
 * @returns {Promise<{id: string, issueNumber: string, status: string, replayed: boolean}>}
 */
export async function submitIssue({ issue, screenshot, annotatedScreenshot, idempotencyKey }) {
  const token = await fetchReporterToken();
  const form = new FormData();
  form.append('issue', new Blob([JSON.stringify(issue)], { type: 'application/json' }));
  if (screenshot) form.append('screenshot', screenshot, `screenshot.${extensionFor(screenshot)}`);
  if (annotatedScreenshot) {
    form.append('annotatedScreenshot', annotatedScreenshot, `annotated.${extensionFor(annotatedScreenshot)}`);
  }
  const { data } = await issueClient.post('/issues', form, {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey },
  });
  return data;
}

/** A message a user can act on, from whichever of the two calls failed. */
export function describeSubmitError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.error;
  if (error?.isOfflineError || (!error?.response && typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'You are offline. Please try again when you are connected.';
  }
  if (code === 'FEEDBACK_NOT_CONFIGURED') return 'Bug reporting is not set up on this server yet.';
  if (status === 429) return 'You have sent many reports in the last hour. Please try again later.';
  if (status === 413 || code === 'PAYLOAD_TOO_LARGE') return 'The screenshot is too large. Remove it and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again and resend the report.';
  if (status === 400 && code === 'VALIDATION_FAILED') {
    if (error?.response?.data?.fieldErrors?.environment) return 'Please choose the environment this happened in.';
    return 'Please check the title and description and try again.';
  }
  if (!error?.response) return 'Could not reach the issue service. Please try again in a moment.';
  return 'The report could not be sent. Please try again.';
}
