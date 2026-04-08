/**
 * Normalize to UTC midnight (date-only semantics for order anchor).
 */
export function startOfDayUTC(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addCalendarDaysUTC(anchorUtcMidnight, offsetDays) {
  const d = new Date(anchorUtcMidnight);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
