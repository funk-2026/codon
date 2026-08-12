import { useTheme } from '@/src/theme/ThemeProvider';

export function useStackScreenOptions() {
  const { color, type } = useTheme();
  return {
    headerStyle: { backgroundColor: color('bg/surface') },
    headerTintColor: color('text/primary'),
    headerTitleStyle: {
      fontFamily: type['type/h3'].fontFamily,
      fontSize: type['type/h3'].fontSize,
      color: color('text/primary'),
    },
    contentStyle: { backgroundColor: color('bg/canvas') },
  } as const;
}
