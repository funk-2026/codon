import { isExpoPushToken, pushStatusCopy, routeFromNotification, shouldRegisterSilently } from '../logic';

describe('push rules', () => {
  it('validates Expo push tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc_DEF-123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[xyz]')).toBe(true);
    expect(isExpoPushToken('fcm:abc')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoPushToken(undefined)).toBe(false);
  });
  it('never registers before the OS permission is granted, and respects an opt-out', () => {
    expect(shouldRegisterSilently('granted', true)).toBe(true);
    expect(shouldRegisterSilently('granted', undefined)).toBe(true);
    expect(shouldRegisterSilently('granted', false)).toBe(false);
    expect(shouldRegisterSilently('undetermined', true)).toBe(false);
    expect(shouldRegisterSilently('denied', true)).toBe(false);
    expect(shouldRegisterSilently('unavailable', true)).toBe(false);
  });
  it('only opens in-app student routes from a notification', () => {
    expect(routeFromNotification({ route: '/(student)/(practice)/test-result' })).toBe('/(student)/(practice)/test-result');
    expect(routeFromNotification({ route: 'https://evil.example' })).toBeNull();
    expect(routeFromNotification({ route: '/(admin)/(review)' })).toBeNull();
    expect(routeFromNotification({ route: '/(student)/../(admin)' })).toBeNull();
    expect(routeFromNotification({})).toBeNull();
    expect(routeFromNotification(null)).toBeNull();
  });
  it('settings copy per state', () => {
    expect(pushStatusCopy('unavailable', false).canToggle).toBe(false);
    expect(pushStatusCopy('denied', false).caption).toMatch(/system settings/);
    expect(pushStatusCopy('granted', true).caption).toBe('On');
  });
});
