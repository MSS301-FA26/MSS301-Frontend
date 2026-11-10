export const toLocalDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Keep the calendar date entered by admin, without converting it through UTC.
export const getShowtimeDateKey = (showtime) => String(showtime.startTime || '').split('T')[0];

export const getShowtimeDates = (showtimes, today = new Date()) => {
  const todayKey = toLocalDateKey(today);
  const counts = new Map();
  // Always show the first seven days; extend only with scheduled dates.
  for (let index = 0; index < 7; index++) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    counts.set(toLocalDateKey(date), 0);
  }
  showtimes.forEach((showtime) => {
    const dateKey = getShowtimeDateKey(showtime);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= todayKey) {
      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    }
  });
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, count]) => ({ dateKey, count }));
};
