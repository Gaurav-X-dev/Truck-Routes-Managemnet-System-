import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_BASE = '/api/v1';

interface AuthState {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,

      login: async (username: string, password: string) => {
        // OAuth2PasswordRequestForm requires form-encoded data
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await axios.post(`${API_BASE}/auth/login`, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token } = res.data;
        if (!access_token) throw new Error('No token received');
        set({ token: access_token });
      },

      logout: () => {
        set({ token: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
