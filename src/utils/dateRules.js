import dayjs from 'dayjs';

/**
 * The one rule about a pair of dates: the later one is not before the earlier.
 *
 * The sibling of {@link ./timeRules.js}, which does the same for a pair of
 * times and cannot be reused here - it compares minutes within a day.
 *
 * This exists because the server and the database both already enforced it and
 * the browser did not, so the only way to find out was to save and read the
 * answer. When the database answered first the answer was
 * "Invalid field value (constraint: asset_amc_order)", which tells somebody
 * filling in a warranty date nothing they can act on. Caught here, the field
 * itself says what is wrong while they are still looking at it.
 *
 * Equal dates pass: a cover that starts and ends on the same day is a single
 * day of cover, not a mistake, and refusing it here would disagree with the
 * server, which allows it.
 */
export const notBeforeRule = (getEarlier, labels = {}) => () => ({
  validator(_, later) {
    const earlier = getEarlier();
    if (!earlier || !later) return Promise.resolve();

    const earlierLabel = labels.earlier ?? 'start date';
    const laterLabel = labels.later ?? 'end date';

    if (dayjs(later).isBefore(dayjs(earlier), 'day')) {
      return Promise.reject(new Error(
        `The ${laterLabel} is before the ${earlierLabel}. Check the two dates.`,
      ));
    }
    return Promise.resolve();
  },
});

export default notBeforeRule;
