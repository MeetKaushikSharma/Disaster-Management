import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser } from '../types';

interface AuthState {
  token: string | null;
  admin: AdminUser | null;
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      login: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'disaster-admin-auth' }
  )
);
