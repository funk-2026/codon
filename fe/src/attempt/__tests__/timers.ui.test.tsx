import { act, renderHook } from '@testing-library/react-native';
import { useQuestionCountdown } from '../useQuestionCountdown';
import { useStopwatch } from '../useStopwatch';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T10:00:00Z'));
});
afterEach(() => jest.useRealTimers());

describe('useQuestionCountdown (review: max 2 min per question)', () => {
  it('counts down from 2:00, fires once at 0, and restarts for the next question', async () => {
    const onExpire = jest.fn();
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useQuestionCountdown(q, 120, true, onExpire), { initialProps: { q: 'q1' } });
    expect(result.current).toBe(120);
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(result.current).toBe(90);
    await act(async () => { jest.advanceTimersByTime(95_000); });
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
    await rerender({ q: 'q2' });
    expect(result.current).toBe(120);
  });

  it('is off when disabled', async () => {
    const { result } = await renderHook(() => useQuestionCountdown('q1', 120, false, () => {}));
    expect(result.current).toBeNull();
  });
});

describe('useStopwatch (untimed tests)', () => {
  it('shows real elapsed time since the attempt started', async () => {
    const started = Date.now() - 65_000; // resumed attempt, started 1:05 ago
    const { result } = await renderHook(() => useStopwatch(started));
    expect(result.current).toBe(65);
    await act(async () => { jest.advanceTimersByTime(5_000); });
    expect(result.current).toBe(70);
  });
});
