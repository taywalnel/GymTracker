/** "Today", "1 day ago", "12 days ago" for a date string starting YYYY-MM-DD. */
export function formatDaysAgo(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  const sessionDay = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const daysAgo = Math.max(0, Math.round((todayDay - sessionDay) / 86400000));

  if (daysAgo === 0) return "Today";
  return `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
}

/**
 * Parses a session or entry date (YYYY-MM-DD) as local midnight. `new Date()`
 * on a date-only string gives UTC midnight, which shows as the previous day
 * west of UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Formats a YYYY-MM-DD date in the user's locale without shifting the day. */
export function formatLocalDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  return parseLocalDate(dateStr).toLocaleDateString(locale, options);
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayLocalDate(): string {
  return localDateFromTimestamp(Date.now());
}

/** The local calendar date of a millisecond timestamp, as YYYY-MM-DD. */
export function localDateFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
