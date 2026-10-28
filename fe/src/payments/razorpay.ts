import Constants, { ExecutionEnvironment } from 'expo-constants';
import type RazorpayCheckoutType from 'react-native-razorpay';

/**
 * Loads `react-native-razorpay` lazily so the app can run in Expo Go.
 *
 * Razorpay is a custom native module that Expo Go doesn't ship; a top-level
 * import makes the whole bundle fail there. Requiring it on demand keeps every
 * other screen usable in Expo Go, and only the Pay button refuses. Dev-client
 * and store builds load the real module as before.
 */
export function loadRazorpay(): typeof RazorpayCheckoutType {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error('Payments aren’t available in Expo Go. Use a dev or release build to test checkout.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-razorpay').default;
}
