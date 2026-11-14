import { auditDetail } from '../auditDetail';

describe('auditDetail', () => {
  it('summarises a role change', () => expect(auditDetail({ before: { role: 'student' }, after: { role: 'teacher' } })).toBe('student → teacher'));
  it('quotes a reason', () => expect(auditDetail({ after: { reason: 'wrong key' } })).toBe('“wrong key”'));
  it('does not crash on before/after that are not objects', () => {
    expect(auditDetail({ before: 'on', after: 'off' })).toBeNull();
    expect(auditDetail({ before: 5, after: [1, 2] })).toBeNull();
    expect(auditDetail({ before: null, after: undefined })).toBeNull();
  });
});
