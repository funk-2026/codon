import { buildHeaders } from '../headers';

describe('buildHeaders', () => {
  it('sets JSON content-type and bearer auth by default', () => {
    expect(buildHeaders('tok')).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
  });
  it('omits Authorization when there is no token', () => {
    expect(buildHeaders(null)).toEqual({ 'Content-Type': 'application/json' });
  });
  it('REGRESSION: a custom header (e.g. Idempotency-Key) merges in without dropping Authorization', () => {
    // This is exactly the bug that logged users out of "Generate" — a custom
    // header must never replace Authorization/Content-Type, only add to them.
    const h = buildHeaders('tok', { 'Idempotency-Key': 'abc123' });
    expect(h).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok', 'Idempotency-Key': 'abc123' });
  });
  it('a caller can still override Content-Type deliberately (e.g. multipart)', () => {
    const h = buildHeaders('tok', { 'Content-Type': 'text/csv' });
    expect(h['Content-Type']).toBe('text/csv');
    expect(h.Authorization).toBe('Bearer tok');
  });
});
