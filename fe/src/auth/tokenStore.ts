import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'codon_access_token';
const USER_KEY = 'codon_user';

export type StoredUser = {
  id: string;
  phone_number: string;
  role: 'student' | 'teacher' | 'admin';
  name: string | null;
  selected_course_id?: string | null;
  kyc_status: string;
};

/** Persist the access token to the OS keychain/keystore */
export async function saveSession(token: string, user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

/** Read the access token (null = not logged in) */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

/** Read the persisted user object */
export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear all auth data (logout) */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
