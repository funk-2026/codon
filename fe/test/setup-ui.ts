import 'react-native-gesture-handler/jestSetup';

/*
 * Jest setup for component ("ui") tests. Native animation modules don't exist
 * in Node, and Reanimated 4.7's bundled mock calls a native-only initialiser,
 * so this is a minimal stand-in for exactly the APIs the app uses: animations
 * resolve to their end value and Animated.* render as plain components.
 */
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => unknown, ...a: unknown[]) => fn(...a), runOnJS: (fn: unknown) => fn }));
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const end = (v: unknown) => v;
  const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, Image: RN.Image, FlatList: RN.FlatList, createAnimatedComponent: (c: unknown) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: end,
    withSpring: end,
    withDelay: (_d: number, v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    withRepeat: end,
    runOnJS: (fn: unknown) => fn,
    interpolate: (v: number, input: number[], output: number[]) => {
      if (v <= input[0]) return output[0];
      for (let i = 1; i < input.length; i++) if (v <= input[i]) return output[i - 1] + ((v - input[i - 1]) / (input[i] - input[i - 1])) * (output[i] - output[i - 1]);
      return output[output.length - 1];
    },
    interpolateColor: (v: number, input: number[], output: string[]) => (v <= input[0] ? output[0] : output[output.length - 1]),
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: () => () => {},
    Easing: { linear: end, ease: end, inOut: () => end, out: () => end, in: () => end, bezier: () => end },
  };
});

// Safe-area insets come from a native provider; use the library's own test mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
