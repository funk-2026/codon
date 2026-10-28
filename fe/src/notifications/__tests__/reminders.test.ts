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
