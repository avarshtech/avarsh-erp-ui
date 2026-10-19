import dayjs from 'dayjs';

/**
 * The one rule about a pair of times: the second comes after the first.
 *
 * It used to be nobody's job. A shift of 09:00 to 06:00 saved without complaint,
 * and attendance of 9am in and 6am out did too - the hours calculation quietly
 * added 24 hours to the negative result and reported nine hours worked, so the
 * mistake looked like a normal day right through to payroll.
 *
 * A night shift is the exception and the only one: 18:00 to 09:00 crosses
 * midnight on purpose. It is flagged on the shift, so the rule is switched off
 * by that flag rather than by guessing from the times themselves - which is
 * what made 9am-to-6am indistinguishable from a real night shift.
 */

const minutes = (value) => (value && dayjs.isDayjs(value) ? value.hour() * 60 + value.minute() : null);

/**
 * A Form.Item rule for the later field of a pair.
 *
 * @param getEarlier  reads the earlier value off the form, e.g. () => form.getFieldValue('startTime')
 * @param isOvernight true when crossing midnight is expected, so the rule stands down
 * @param labels      what to call the two fields in the message
 */
export const afterRule = (getEarlier, isOvernight, labels = {}) => () => ({
  validator(_, later) {
    if (isOvernight) return Promise.resolve();

    const from = minutes(getEarlier());
    const to = minutes(later);
    if (from === null || to === null) return Promise.resolve();

    const earlierLabel = labels.earlier ?? 'start time';
    const laterLabel = labels.later ?? 'end time';

    if (to === from) {
      return Promise.reject(new Error(`The ${laterLabel} cannot be the same as the ${earlierLabel}.`));
    }
    if (to < from) {
      return Promise.reject(new Error(
        `The ${laterLabel} is before the ${earlierLabel}. Tick Night Shift if it is meant to cross midnight.`,
      ));
    }
    return Promise.resolve();
  },
});

/** The same rule where no night shift exists to excuse it - a gate pass, within one day. */
export const afterRuleSameDay = (getEarlier, labels = {}) => () => ({
  validator(_, later) {
    const from = minutes(getEarlier());
    const to = minutes(later);
    if (from === null || to === null) return Promise.resolve();

    const earlierLabel = labels.earlier ?? 'from time';
    const laterLabel = labels.later ?? 'to time';
    if (to <= from) {
      return Promise.reject(new Error(`The ${laterLabel} must be after the ${earlierLabel}.`));
    }
    return Promise.resolve();
  },
});
