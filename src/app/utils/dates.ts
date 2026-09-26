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
