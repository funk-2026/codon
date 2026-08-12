// MOCK — remove when real auth exists
import React, { createContext, useContext, useState } from 'react';

export type Role = 'student' | 'teacher' | 'admin';

type RoleContextValue = {
  currentRole: Role | null;
  setCurrentRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  return (
    <RoleContext.Provider value={{ currentRole, setCurrentRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return ctx;
}
