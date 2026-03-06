'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '@/lib/api';

export type Role = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'USER_ADMIN' | 'STAFF';
export type StaffRole = 'DISPLAY_MANAGER' | 'BROADCAST_MANAGER' | 'CONTENT_MANAGER' | 'CMS_VIEWER' | 'POP_MANAGER';

interface User {
  id: string;
  email: string;
  role: Role;
  staffRole?: StaffRole;
  isActive: boolean;

  // ✅ ADD THIS (required for USER_ADMIN logic)
  managedByClientAdminId?: string | null;

  clientProfile?: {
    maxDisplays: number;
    maxUsers: number;
    licenseExpiry?: string;
    companyName?: string;
  };
}


interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get('accessToken') || localStorage.getItem('accessToken');
      if (token) {
        try {
          // Verify token by fetching user data
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          // Token invalid, clear it
          Cookies.remove('accessToken');
          localStorage.removeItem('accessToken');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login for:', email);
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user: userData } = response.data;

      if (!accessToken || !userData) {
        throw new Error('Invalid response from server');
      }

      // Store token in both cookie and localStorage for compatibility.
      // IMPORTANT: secure cookies are ignored on http://localhost, so only set secure in production.
      Cookies.set('accessToken', accessToken, {
        expires: 365,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      localStorage.setItem('accessToken', accessToken);

      setUser(userData);
      console.log('Login successful, redirecting...', userData.role);

      // Determine redirect path based on role
      let redirectPath = '/dashboard';
      if (userData.role === 'SUPER_ADMIN') {
        redirectPath = '/super-admin/dashboard';
      } else if (userData.role === 'CLIENT_ADMIN') {
        redirectPath = '/client/dashboard';
      } else if (userData.role === 'USER_ADMIN') {
        redirectPath = '/user/dashboard';
      } else if (userData.role === 'STAFF') {
        redirectPath = '/staff/dashboard';
      }

      // Use router.push with fallback to window.location
      try {
        router.push(redirectPath);
        // Fallback: if router doesn't work, use window.location
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.location.href = redirectPath;
          }
        }, 100);
      } catch (redirectError) {
        console.error('Router push failed, using window.location:', redirectError);
        if (typeof window !== 'undefined') {
          window.location.href = redirectPath;
        }
      }
    } catch (error: any) {
      console.error('Login error details:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    
    // Clear tokens first
    Cookies.remove('accessToken');
    localStorage.removeItem('accessToken');
    
    // Clear user state
    setUser(null);
    
    // Force full page reload to login page
    // This ensures all component state is cleared
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
