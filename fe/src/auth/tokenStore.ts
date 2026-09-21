import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'codon_access_token';
const USER_KEY = 'codon_user';
const ADMIN_ACTIVE_ROLE_KEY = 'codon_admin_active_role';

export type AdminActiveRole = 'admin' | 'teacher' | 'student';

export type StoredUser = {
  id: string;
  phone_number: string;
  role: 'student' | 'teacher' | 'admin';
  name: string | null;
  selected_course_id?: string | null;
  kyc_status: string;
};

/**
 * expo-secure-store has no OS keychain to defer to on web, so its web
 * build is an empty stub. Fall back to localStorage there (dev/web
 * preview only — the shipped app is native).
 */
const store = Platform.OS === 'web'
  ? {
      getItemAsync: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
      setItemAsync: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
      deleteItemAsync: async (key: string) => globalThis.localStorage?.removeItem(key),
    }
  : SecureStore;

/** Persist the access token to the OS keychain/keystore */
export async function saveSession(token: string, user: StoredUser): Promise<void> {
  await store.setItemAsync(ACCESS_TOKEN_KEY, token);
  await store.setItemAsync(USER_KEY, JSON.stringify(user));
}

/** Read the access token (null = not logged in) */
export async function getAccessToken(): Promise<string | null> {
  return store.getItemAsync(ACCESS_TOKEN_KEY);
}

/** Read the persisted user object */
export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await store.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear all auth data (logout) */
export async function clearSession(): Promise<void> {
  await store.deleteItemAsync(ACCESS_TOKEN_KEY);
  await store.deleteItemAsync(USER_KEY);
  await store.deleteItemAsync(ADMIN_ACTIVE_ROLE_KEY);
}

export async function saveAdminActiveRole(role: AdminActiveRole): Promise<void> {
  await store.setItemAsync(ADMIN_ACTIVE_ROLE_KEY, role);
}

export async function getAdminActiveRole(): Promise<AdminActiveRole | null> {
  const raw = await store.getItemAsync(ADMIN_ACTIVE_ROLE_KEY);
  if (raw === 'admin' || raw === 'teacher' || raw === 'student') return raw;
  return null;
}

export async function clearAdminActiveRole(): Promise<void> {
  await store.deleteItemAsync(ADMIN_ACTIVE_ROLE_KEY);
}
