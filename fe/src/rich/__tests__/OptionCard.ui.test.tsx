import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { OptionCard } from '../OptionCard';
import { RichContent } from '../RichContent';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);


describe('OptionCard (component)', () => {
  it('announces letter, text and state, and selects on press', async () => {
    const onPress = jest.fn();
    await wrap(<OptionCard letter="B" value="Mitochondria" format="rich_v1" state="selected" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Option B. Mitochondria. selected' });
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is labelled "crossed out" when struck and offers the long-press action', async () => {
    const onLongPress = jest.fn();
    await wrap(<OptionCard letter="C" value="Ribosome" format="rich_v1" state="struck" onPress={() => {}} onLongPress={onLongPress} longPressLabel="Restore option C" />);
    const btn = screen.getByRole('button', { name: 'Option C. Ribosome. crossed out' });
    expect(btn.props.accessibilityActions).toEqual([{ name: 'longpress', label: 'Restore option C' }]);
  });
});

describe('RichContent (component)', () => {
  it('renders bold and subscript text', async () => {
    await wrap(<RichContent value="**Water** is H~2~O" format="rich_v1" />);
    expect(screen.getByText('Water')).toBeTruthy();
    expect(screen.getByText(/H₂O|H/)).toBeTruthy();
  });

  it('never interprets legacy plain text', async () => {
    await wrap(<RichContent value="**not bold**" format="plain" />);
    expect(screen.getByText('**not bold**')).toBeTruthy();
  });
});
