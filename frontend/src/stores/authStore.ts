import { create } from 'zustand';

// Password hashing utility using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Registered users database in localStorage
interface RegisteredUser {
  email: string;
  name: string;
  country: string;
  passwordHash: string;
}

// Get all registered users from localStorage
const getRegisteredUsers = (): Record<string, RegisteredUser> => {
  try {
    const usersData = localStorage.getItem('registeredUsers');
    return usersData ? JSON.parse(usersData) : {};
  } catch (error) {
    console.error('Error reading registered users:', error);
    return {};
  }
};

// Save registered user to localStorage
const saveRegisteredUser = (user: RegisteredUser): void => {
  try {
    const users = getRegisteredUsers();
    users[user.email] = user;
    localStorage.setItem('registeredUsers', JSON.stringify(users));
  } catch (error) {
    console.error('Error saving registered user:', error);
  }
};

// Get specific registered user
const getRegisteredUser = (email: string): RegisteredUser | null => {
  const users = getRegisteredUsers();
  return users[email] || null;
};

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
      // Check if user exists in registered users
      const registeredUser = getRegisteredUser(email);
      if (!registeredUser) {
        return { success: false, message: 'Invalid email or password' };
      }

      // Verify password
      const passwordHash = await hashPassword(password);
      if (passwordHash !== registeredUser.passwordHash) {
        return { success: false, message: 'Invalid email or password' };
      }

      // Login successful - create session
      const user: User = {
        email: registeredUser.email,
        name: registeredUser.name,
        country: registeredUser.country
      };
      localStorage.setItem('loggedInUser', JSON.stringify(user));

      // Keep password hash for password change validation
      localStorage.setItem(`userPasswordHash_${email}`, passwordHash);

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
      // Check if user already exists
      const existingUser = getRegisteredUser(data.email);
      if (existingUser) {
        return { success: false, message: 'An account with this email already exists' };
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Save to registered users database
      const registeredUser: RegisteredUser = {
        email: data.email,
        name: data.name,
        country: data.country,
        passwordHash: passwordHash
      };
      saveRegisteredUser(registeredUser);

      // Create user session
      const user: User = {
        email: data.email,
        name: data.name,
        country: data.country
      };
      localStorage.setItem('loggedInUser', JSON.stringify(user));

      // Keep password hash for password change validation
      localStorage.setItem(`userPasswordHash_${data.email}`, passwordHash);

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
