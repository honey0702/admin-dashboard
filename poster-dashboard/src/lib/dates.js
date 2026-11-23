/** Minimal date helpers (no external dependency). */

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const subDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() - n);
  return c;
};

export const addDays = (d, n) => subDays(d, -n);

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isSameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export function format(d, fmt) {
  if (fmt === 'd MMM') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  if (fmt === 'yyyy-MM-dd') {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (fmt === 'd MMM yyyy') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-IN');
}

/** ISO string for an offset in whole days before `now`, pinned to wall-clock h:m. */
export function daysAgoAt(now, daysBack, hour = 12, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
