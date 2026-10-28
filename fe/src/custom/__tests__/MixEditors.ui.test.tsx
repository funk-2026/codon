import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { DifficultyMixEditor } from '../MixEditors';

describe('DifficultyMixEditor (component)', () => {
  it('applies only when the percentages add up to 100', async () => {
    const onChange = jest.fn();
    await render(<ThemeProvider><DifficultyMixEditor mix={{ easy: 0.3, medium: 0.5, hard: 0.2 }} onChange={onChange} /></ThemeProvider>);
    onChange.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Easy questions' })); // 40/50/20 = 110
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Adds up to 110/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Medium questions' })); // 40/40/20 = 100
    expect(onChange).toHaveBeenLastCalledWith({ easy: 0.4, medium: 0.4, hard: 0.2 });
  });
});
