import { groupBoardDocs } from '../group';
import type { ReferenceDoc } from '@/src/api/reference';

const doc = (o: Partial<ReferenceDoc>): ReferenceDoc => ({ id: Math.random().toString(), kind: 'past_paper', title: 'T', size_bytes: 0, is_active: true, ...o });

describe('groupBoardDocs', () => {
  it('groups by board then subject, newest year first', () => {
    const g = groupBoardDocs([
      doc({ board: 'Maharashtra', subject: 'Mathematics', year: 2023, title: 'a' }),
      doc({ board: 'CBSE', subject: 'Physics', year: 2024, title: 'b' }),
      doc({ board: 'Maharashtra', subject: 'Mathematics', year: 2025, title: 'c' }),
      doc({ board: 'Maharashtra', subject: 'Social Science', year: 2025, title: 'd' }),
    ]);
    expect(g.map((b) => b.board)).toEqual(['CBSE', 'Maharashtra']);
    const maha = g[1].subjects;
    expect(maha.map((s) => s.subject)).toEqual(['Mathematics', 'Social Science']);
    expect(maha[0].docs.map((d) => d.year)).toEqual([2025, 2023]);
  });
  it('shows nothing for nothing, and keeps papers without a board or subject findable', () => {
    expect(groupBoardDocs([])).toEqual([]);
    const g = groupBoardDocs([doc({ title: 'x' })]);
    expect(g[0].board).toBe('Other');
    expect(g[0].subjects[0].subject).toBe('General');
  });
});
