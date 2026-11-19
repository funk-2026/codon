// Pure geometry for the daily line chart, so the axes and ticks can be tested.
export type ChartPoint = { label: string; value: number };

/** A y-axis top that is a round number at or above the data, with 4 gridlines. */
export function niceMax(values: number[]): { max: number; ticks: number[] } {
  const top = Math.max(0, ...values);
  const max = top <= 4 ? 4 : Math.ceil(top / 4) * 4;
  return { max, ticks: [0, 1, 2, 3, 4].map((i) => (max / 4) * i) };
}

/** x for point i of n inside [left, right]; a single point sits in the middle. */
export const xAt = (i: number, n: number, left: number, right: number) => (n <= 1 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1));
export const yAt = (v: number, max: number, top: number, bottom: number) => bottom - ((bottom - top) * v) / max;

/** The last `days` local days ending today, oldest first, as `YYYY-MM-DD` keys with a short label. */
export function lastDays(days: number, now: Date = new Date()): { key: string; label: string }[] {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
    return { key: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, label: `${d.getDate()}` };
  });
}
