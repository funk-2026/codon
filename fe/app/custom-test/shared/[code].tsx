import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link target for codon://custom-test/shared/<code> → opens the builder pre-filled with the shared setup. */
export default function SharedCustomTestRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/(student)/(practice)/custom-builder', params: { code: String(code ?? '') } }} />;
}
