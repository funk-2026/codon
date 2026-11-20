/**
 * The one way dates are written for students: "3 May 2027" and "Sat, 3 May, 9:30 am".
 * Always en-IN, so two phones with different regions show the same thing.
 */
const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const DATE_TIME: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };

function parse(v: string | number | Date | null | undefined): Date | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(v: string | number | Date | null | undefined): string {
  const d = parse(v);
  return d ? d.toLocaleDateString('en-IN', DATE) : '';
}

export function formatDateTime(v: string | number | Date | null | undefined): string {
  const d = parse(v);
  return d ? d.toLocaleString('en-IN', DATE_TIME).replace(/\bam\b/i, 'am').replace(/\bpm\b/i, 'pm') : '';
}

/** Money in rupees, grouped the Indian way. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
