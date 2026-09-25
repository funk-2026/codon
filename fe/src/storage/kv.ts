import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny JSON key-value wrapper. Storage can throw or be unavailable (quota,
 * private mode, web), so every call is guarded and callers always get a
 * sensible fallback — persistence is a convenience, never a dependency.
 */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort */
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}
