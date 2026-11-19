import { colors, darkColors } from '../tokens';

jest.mock('react-native', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/src/storage/kv', () => ({ kvGet: jest.fn(async (_k: string, d: unknown) => d), kvSet: jest.fn(async () => {}) }));
import { resolveScheme } from '../ThemeProvider';

describe('theme', () => {
  it('follows the phone only when the student chose System', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
  it('the dark palette defines every token the light one does', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
  });
  it('dark text is lighter than the dark canvas', () => {
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;
    expect(lum(darkColors['text/primary'])).toBeGreaterThan(lum(darkColors['bg/canvas']) + 100);
    expect(lum(darkColors['text/secondary'])).toBeGreaterThan(lum(darkColors['bg/surface']) + 80);
  });
});
