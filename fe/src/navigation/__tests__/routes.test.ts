import { normalizeRoute } from '../routes';

describe('normalizeRoute', () => {
  it('maps old per-tab detail routes to the hoisted ones', () => {
    expect(normalizeRoute('/(student)/(practice)/test-history')).toBe('/(student)/test-history');
    expect(normalizeRoute('/(admin)/(review)/kyc-queue')).toBe('/(admin)/kyc-queue');
  });
  it('maps old tab roots to the tab hubs', () => {
    expect(normalizeRoute('/(student)/(home)')).toBe('/(student)/(tabs)/home');
    expect(normalizeRoute('/(student)/(learn)/index')).toBe('/(student)/(tabs)/learn');
  });
  it('keeps the two browse screens apart', () => {
    expect(normalizeRoute('/(student)/(learn)/hierarchy')).toBe('/(student)/learn-hierarchy');
    expect(normalizeRoute('/(student)/(practice)/hierarchy')).toBe('/(student)/practice-hierarchy');
  });
  it('leaves current routes untouched', () => {
    expect(normalizeRoute('/(student)/test-result')).toBe('/(student)/test-result');
    expect(normalizeRoute('/(student)/(tabs)/home')).toBe('/(student)/(tabs)/home');
  });
});
