jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/src/storage/kv', () => ({ kvGet: jest.fn(async (_k: string, d: unknown) => d), kvSet: jest.fn(async () => {}) }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { hourLabel } from '../reminders';

describe('hourLabel', () => {
  it('formats 24h hours as 12h clock labels', () => {
    expect(hourLabel(7)).toBe('7:00 AM');
    expect(hourLabel(12)).toBe('12:00 PM');
    expect(hourLabel(19)).toBe('7:00 PM');
    expect(hourLabel(0)).toBe('12:00 AM');
  });
});

import { normalizeReminder, toggleHour } from '../reminders';

describe('reminder state', () => {
  it('reads the old single-time shape', () => {
    expect(normalizeReminder('practice', { enabled: true, hour: 19 })).toEqual({ enabled: true, hours: [19] });
  });
  it('drops times that are not offered, and stays off with no valid time', () => {
    expect(normalizeReminder('practice', { enabled: true, hours: [7, 8, 21] })).toEqual({ enabled: true, hours: [7, 21] });
    expect(normalizeReminder('water', { enabled: true, hours: [3] }).enabled).toBe(false);
    expect(normalizeReminder('breathing', null).enabled).toBe(false);
  });
  it('lets several times be chosen, and the last removal turns it off', () => {
    let s = { enabled: true, hours: [19] };
    s = toggleHour(s, 7);
    expect(s.hours).toEqual([7, 19]);
    s = toggleHour(s, 19);
    expect(s).toEqual({ enabled: true, hours: [7] });
    expect(toggleHour(s, 7).enabled).toBe(false);
  });
});
