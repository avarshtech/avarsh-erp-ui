/**
 * Sending a report to the separate issue service.
 *
 * Where the ERP API can mint a reporter token (POST /feedback/token, once its signing key is set), the
 * report carries it and the issue service takes the reporter and environment from it. Where it cannot
 * (the dev phase: no keys anywhere), the report goes without a token and names the signed-in user from the
 * ERP session; the issue service accepts that only while its own security switch is off.
 *
 * The issue service gets its own axios client with no interceptors and no cookies: the ERP's client
 * would attach the ERP session token (which must never leave the ERP) and show its error toasts.
 */
import axios from 'axios';
import axiosInstance from '../core/axiosInstance';
import { getCachedUserDisplay } from '../auth/sessionStore';
import { FEEDBACK_API_URL } from './feedbackConfig';

const issueClient = axios.create({
  baseURL: FEEDBACK_API_URL,
  timeout: 60000,
  withCredentials: false,
});

async function fetchReporterSession() {
  const { data } = await axiosInstance.post('/feedback/token', null, { silent: true, feedbackIgnore: true });
  return data;
}

/** The ERP's reporter token and details, or null where the ERP cannot mint one. */
async function tryReporterSession() {
  try {
    return await fetchReporterSession();
  } catch {
    return null;
  }
}

/**
 * The signed-in user as the ERP UI's session knows them, in the issue service's reporter shape.
 * Login fills a placeholder e-mail (username@avarsh.com) when the ERP has none; that one is not sent.
 * @returns {{userId, username, name, email, role}|null}
 */
export function reporterFromSession(user = getCachedUserDisplay()) {
  if (!user) return null;
  const username = user.username || undefined;
  const placeholderEmail = username && user.email === `${username}@avarsh.com`;
  return {
    userId: user.id != null ? String(user.id) : undefined,
    username,
    name: user.name || undefined,
    email: (!placeholderEmail && user.email) || undefined,
    role: user.role || undefined,
  };
}

/**
 * Who the report will be filed as and which environment the ERP server says it is, for the dialog to
 * show. Any token in the answer is discarded: submitting asks for a fresh one, so a report can never go
 * out under a previous user's token.
 * @returns {Promise<{environment: string|null, reporter: {userId, username, name, email, role}|null}>}
 */
export async function loadReporterDetails() {
  const data = await tryReporterSession();
  return { environment: data?.environment || null, reporter: data?.reporter || reporterFromSession() };
}

const extensionFor = (blob) => (blob.type === 'image/jpeg' ? 'jpg' : 'png');

/**
 * @returns {Promise<{id: string, issueNumber: string, status: string, replayed: boolean}>}
 */
export async function submitIssue({ issue, screenshot, annotatedScreenshot, idempotencyKey }) {
  const session = await tryReporterSession();
  const reporter = session?.reporter || reporterFromSession() || undefined;
  const form = new FormData();
  form.append('issue', new Blob([JSON.stringify({ ...issue, reporter })], { type: 'application/json' }));
  if (screenshot) form.append('screenshot', screenshot, `screenshot.${extensionFor(screenshot)}`);
  if (annotatedScreenshot) {
    form.append('annotatedScreenshot', annotatedScreenshot, `annotated.${extensionFor(annotatedScreenshot)}`);
  }
  const { data } = await issueClient.post('/issues', form, {
    headers: {
      'Idempotency-Key': idempotencyKey,
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
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
