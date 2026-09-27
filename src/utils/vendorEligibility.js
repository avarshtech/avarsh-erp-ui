import dayjs from 'dayjs';
import { DATE_FORMAT } from './uiConstants';

/**
 * Job-work approval of a supplier on a date (default today). The approval runs to the
 * end of its valid-until day; an empty date means the job worker is not approved yet.
 *
 * @returns {{ status: 'approved'|'expired'|'missing', label: string, color: string }}
 */
export const jobWorkApproval = (validUntil, onDate = dayjs()) => {
  if (!validUntil) return { status: 'missing', label: 'Not approved', color: 'default' };
  const until = dayjs(validUntil);
  if (dayjs(onDate).isAfter(until, 'day')) {
    return { status: 'expired', label: `Expired ${until.format(DATE_FORMAT)}`, color: 'error' };
  }
  return { status: 'approved', label: `Approved to ${until.format(DATE_FORMAT)}`, color: 'success' };
};
