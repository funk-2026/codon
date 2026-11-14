import { teacherRouteFor } from '../teacherRoutes';

const id = '123e4567-e89b-12d3-a456-426614174000';

describe('teacherRouteFor', () => {
  it('opens the item for review outcomes', () => {
    expect(teacherRouteFor('test_approved', { id })).toContain('type=Test&id=' + id);
    expect(teacherRouteFor('test_published', { id })).toContain('type=Test');
    expect(teacherRouteFor('brain_hack_rejected', { id })).toContain('Brain%20Hack');
    expect(teacherRouteFor('deck_approved', { id })).toContain('flashcard-deck?id=' + id);
    expect(teacherRouteFor('content_transferred', { id })).toContain('content-preview?id=' + id);
  });
  it('opens nothing without a real id or a known type', () => {
    expect(teacherRouteFor('test_approved', { id: '../x' })).toBeNull();
    expect(teacherRouteFor('test_approved', null)).toBeNull();
    expect(teacherRouteFor('streak_nudge', { id })).toBeNull();
  });
});
