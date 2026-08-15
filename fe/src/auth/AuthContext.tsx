import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  saveSession,
  getAccessToken,
  getStoredUser,
  clearSession,
  type StoredUser,
} from './tokenStore';
import { getMe } from '../api/profile';

export type Role = 'student' | 'teacher' | 'admin';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; token: string; user: StoredUser };

type AuthContextValue = AuthState & {
  user?: StoredUser;
  token?: string;
  signIn: (token: string, user: StoredUser) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // On mount — try to restore session from secure storage
  useEffect(() => {
    (async () => {
      const [token, user] = await Promise.all([getAccessToken(), getStoredUser()]);
      if (token && user) {
        setState({ status: 'authenticated', token, user });
      } else {
        setState({ status: 'unauthenticated' });
      }
    })();
  }, []);

  const signIn = useCallback(async (token: string, user: StoredUser) => {
    await saveSession(token, user);
    setState({ status: 'authenticated', token, user });
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setState({ status: 'unauthenticated' });
  }, []);

  const refreshUser = useCallback(async () => {
    if (state.status !== 'authenticated') return;
    try {
      const { user: profile } = await getMe();
      const updatedUser: StoredUser = {
        id: profile.id,
        phone_number: profile.phone_number,
        role: profile.role,
        name: profile.name,
        selected_course_id: profile.selected_course_id,
        kyc_status: profile.kyc_status,
      };
      await saveSession(state.token, updatedUser);
      setState({ ...state, user: updatedUser });
    } catch (e) {
      console.error('Failed to refresh user', e);
    }
  }, [state]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
