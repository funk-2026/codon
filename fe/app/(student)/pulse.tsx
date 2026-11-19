import { EmptyState, Screen, ScreenHeader } from '@/src/components';
import { Hourglass } from 'phosphor-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

/** Opens from the Home tile. The real screen is built in a later step; until then this says so plainly. */
export default function PulseRoute() {
  const { color } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Pulse" />
      <EmptyState icon={<Hourglass size={32} color={color('text/tertiary')} />} title="Coming soon" description="One-minute revision items, chapter by chapter. Being built next." />
    </Screen>
  );
}
