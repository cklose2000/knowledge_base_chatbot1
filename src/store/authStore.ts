import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      
      login: async (username: string, password: string) => {
        // Simulate API call with delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For POC, accept any username/password combination
        if (username.trim() && password.trim()) {
          set({ isAuthenticated: true, username });
          return true;
        }
        return false;
      },
      
      logout: () => {
        set({ isAuthenticated: false, username: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
); 