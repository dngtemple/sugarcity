import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { statusOf, writeToken } from '../lib/api';
import { invalidateCache } from '../lib/cache';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

interface AuthState {
  user: StaffUser | null;
  token: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<StaffUser>;
  signOut: () => Promise<void>;
  bootstrap: () => Promise<void>;
  setUser: (user: StaffUser) => void;
}

/** `/auth/me` may answer `{user}` or the user itself. */
const userFrom = (data: { user?: StaffUser } & Partial<StaffUser>): StaffUser => {
  const u = (data.user ?? data) as StaffUser & { _id?: string };
  return { id: u.id ?? u._id ?? '', name: u.name, email: u.email, phone: u.phone, role: u.role };
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      ready: false,
      signIn: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        writeToken(data.token);
        invalidateCache();
        const user = userFrom(data);
        set({ user, token: data.token });
        return user;
      },
      signOut: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        writeToken(null);
        invalidateCache();
        set({ user: null, token: null });
      },
      bootstrap: async () => {
        if (!get().token) {
          set({ ready: true });
          return;
        }
        try {
          const { data } = await api.get('/auth/me');
          set({ user: userFrom(data) });
        } catch (err) {
          // Only a clear "no" ends the session. A slow or sleeping API keeps it.
          const status = statusOf(err);
          if (status === 401 || status === 403) {
            writeToken(null);
            set({ user: null, token: null });
          }
        } finally {
          set({ ready: true });
        }
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'sc-admin-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => writeToken(state?.token ?? null),
    }
  )
);
