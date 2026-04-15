import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../types';
import axios from 'axios';

const API = 'http://localhost:5000/api';

/** Session duration: 30 minutes in milliseconds */
const SESSION_DURATION_MS = 30 * 60 * 1000;

const KEYS = {
  user:    'infra_pulse_user',
  token:   'infra_pulse_token',
  expiry:  'infra_pulse_session_expiry',
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  sessionExpiresAt: number | null;   // Unix timestamp (ms) when session ends
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/** Maps the raw API user payload to the frontend User type */
function mapApiUser(apiUser: any): User {
  return {
    id: String(apiUser.id ?? apiUser._id),
    anonymousHandle: apiUser.anonymousHandle ?? 'Anonymous',
    role: apiUser.role ?? 'student',
    reportCount: apiUser.reportCount ?? 0,
    resolvedCount: apiUser.resolvedCount ?? 0,
    joinedAt: apiUser.joinedAt ?? new Date().toISOString(),
    notificationsEnabled: apiUser.notificationsEnabled ?? true,
  };
}

/** Save a fresh 30-minute session window to localStorage */
function stampSession(): number {
  const expiry = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(KEYS.expiry, String(expiry));
  return expiry;
}

/** Return stored expiry if still valid, otherwise null */
function getValidExpiry(): number | null {
  const raw = localStorage.getItem(KEYS.expiry);
  if (!raw) return null;
  const expiry = parseInt(raw, 10);
  return Date.now() < expiry ? expiry : null;
}

function clearSession() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Schedule auto-logout exactly when the session expires */
  const scheduleExpiry = useCallback((expiry: number) => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    const remaining = expiry - Date.now();
    if (remaining <= 0) return;
    expiryTimerRef.current = setTimeout(() => {
      performLogout();
    }, remaining);
  }, []);

  const performLogout = useCallback(() => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    setUser(null);
    setSessionExpiresAt(null);
    clearSession();
    axios.post(`${API}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
  }, []);

  /** Restore session on page load / refresh */
  useEffect(() => {
    const expiry = getValidExpiry();
    if (!expiry) {
      // Session expired or never started — clear stale data
      clearSession();
      return;
    }
    const storedUser = localStorage.getItem(KEYS.user);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setSessionExpiresAt(expiry);
      scheduleExpiry(expiry);
    }

    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [scheduleExpiry]);

  /** Extend session by another 30 min on user activity (mousemove / keydown) */
  useEffect(() => {
    if (!user) return;

    const extendSession = () => {
      if (!localStorage.getItem(KEYS.token)) return; // already logged out
      const newExpiry = stampSession();
      setSessionExpiresAt(newExpiry);
      scheduleExpiry(newExpiry);
    };

    // Throttle — only refresh the stamp at most once per minute
    let lastActivity = 0;
    const throttled = () => {
      const now = Date.now();
      if (now - lastActivity > 60_000) {
        lastActivity = now;
        extendSession();
      }
    };

    window.addEventListener('mousemove', throttled);
    window.addEventListener('keydown', throttled);
    window.addEventListener('click', throttled);

    return () => {
      window.removeEventListener('mousemove', throttled);
      window.removeEventListener('keydown', throttled);
      window.removeEventListener('click', throttled);
    };
  }, [user, scheduleExpiry]);

  const persistAuth = (mapped: User, token: string) => {
    localStorage.setItem(KEYS.user, JSON.stringify(mapped));
    localStorage.setItem(KEYS.token, token);
    const expiry = stampSession();
    setUser(mapped);
    setSessionExpiresAt(expiry);
    scheduleExpiry(expiry);
  };

  const login = async (email: string, password: string) => {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    persistAuth(mapApiUser(res.data.user), res.data.token);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password }, { withCredentials: true });
    persistAuth(mapApiUser(res.data.user), res.data.token);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      sessionExpiresAt,
      login,
      logout: performLogout,
      register,
    }}>
      {children}
    </AuthContext.Provider>
  );
};