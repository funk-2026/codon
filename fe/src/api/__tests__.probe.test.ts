import { qs } from '@/src/api/client';
test('probe', () => { expect(qs({a:1})).toBe('?a=1'); });
