import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { MasteryHeatmap } from '../MasteryHeatmap';
import type { MasteryRow } from '@/src/api/analytics';

const row = (p: Partial<MasteryRow>): MasteryRow => ({
  chapter_id: 'c1', chapter: 'Cell biology', subject_id: 's1', subject: 'Biology',
  questions_attempted: 10, answers: 10, correct: 3, accuracy: 0.3, last_practised: null, bucket: 'weak', ...p,
});

describe('MasteryHeatmap (component)', () => {
  it('labels each tile with chapter, percent and bucket, and opens practise for a chapter', async () => {
    const onPractise = jest.fn();
    await render(
      <ThemeProvider>
        <MasteryHeatmap
          subjects={[{ name: 'Biology', accuracy: 0.5, correct: 10, answers: 20, chapters: [row({}), row({ chapter_id: 'c2', chapter: 'Genetics', accuracy: 0.9, bucket: 'strong' })] }]}
          onPractise={onPractise}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Genetics: 90 percent, Strong' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cell biology: 30 percent, Needs work' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Practise this chapter' }));
    expect(onPractise).toHaveBeenCalledWith('c1');
  });

  it('shows "not enough data" without a percentage', async () => {
    await render(
      <ThemeProvider>
        <MasteryHeatmap subjects={[{ name: 'Physics', accuracy: 0, correct: 0, answers: 1, chapters: [row({ chapter: 'Optics', bucket: 'not_enough_data' })] }]} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Optics: not enough data' })).toBeTruthy();
  });
});
