import { describeWait, parseSchedule, scheduleError } from '../schedule';

describe('parseSchedule', () => {
  it('reads a valid date and time', () => {
    const d = parseSchedule('03/05/2027', '18:30');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2027, 4, 3, 18, 30]);
  });
  it('rejects impossible dates and times', () => {
    expect(parseSchedule('31/02/2027', '10:00')).toBeNull();
    expect(parseSchedule('03/05/2027', '24:00')).toBeNull();
    expect(parseSchedule('03/05/2027', '9')).toBeNull();
    expect(parseSchedule('2027-05-03', '10:00')).toBeNull();
  });
});

describe('scheduleError', () => {
  const now = new Date(2027, 4, 3, 12, 0);
  it('accepts a future time', () => expect(scheduleError('03/05/2027', '13:00', now)).toBeNull());
  it('refuses the past and the next minute', () => {
    expect(scheduleError('03/05/2027', '11:00', now)).toMatch(/future/);
    expect(scheduleError('03/05/2027', '12:00', now)).toMatch(/future/);
  });
  it('explains a bad format', () => expect(scheduleError('x', 'y', now)).toMatch(/DD\/MM\/YYYY/));
});

describe('describeWait', () => {
  it('speaks in hours then days', () => {
    expect(describeWait(0.4)).toBe('under an hour');
    expect(describeWait(6.2)).toBe('about 6 hours');
    expect(describeWait(72)).toBe('about 3 days');
    expect(describeWait(undefined)).toBeNull();
  });
});
