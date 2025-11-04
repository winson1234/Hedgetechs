import { create } from 'zustand';

interface User {
  email: string;
  name?: string;
  country?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: { email: string; password: string; name: string; country: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  checkAuthStatus: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  isLoading: true,

  checkAuthStatus: () => {
    try {
      const loggedInUser = localStorage.getItem('loggedInUser');
      if (loggedInUser) {
        const user = JSON.parse(loggedInUser);
        set({ isLoggedIn: true, user, isLoading: false });
      } else {
        set({ isLoggedIn: false, user: null, isLoading: false });
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      set({ isLoggedIn: false, user: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    // Simple validation
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' };
    }

    if (!email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' };
    }

    try {
      // TODO: Replace with actual API call when backend auth is implemented
      // For now, using localStorage as per existing implementation
      const user: User = { email, name: email.split('@')[0] };
      localStorage.setItem('loggedInUser', JSON.stringify(user));
      set({ isLoggedIn: true, user });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred during login' };
    }
  },

  register: async (data) => {
    // Simple validation
    if (!data.email || !data.password || !data.name || !data.country) {
      return { success: false, message: 'All fields are required' };
    }

    if (!data.email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address' };
    }

    if (data.password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' };
    }

    try {
      // TODO: Replace with actual API call when backend auth is implemented
      const user: User = {
        email: data.email,
        name: data.name,
        country: data.country
      };
      localStorage.setItem('loggedInUser', JSON.stringify(user));
      set({ isLoggedIn: true, user });
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'An error occurred during registration' };
    }
  },

  logout: () => {
    localStorage.removeItem('loggedInUser');
    set({ isLoggedIn: false, user: null });
  },
}));
