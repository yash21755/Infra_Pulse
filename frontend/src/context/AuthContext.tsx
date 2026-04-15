import React, { createContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { dummyUser } from '../data/dummyData';
import { generateHandle } from '../utils/generateHandle';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
  register: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('infra_pulse_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const login = async () => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setUser(dummyUser);
        localStorage.setItem('infra_pulse_user', JSON.stringify(dummyUser));
        resolve();
      }, 800);
    });
  };

  const register = async () => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const newUser: User = { ...dummyUser, anonymousHandle: generateHandle(), reportCount: 0, resolvedCount: 0 };
        setUser(newUser);
        localStorage.setItem('infra_pulse_user', JSON.stringify(newUser));
        resolve();
      }, 800);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('infra_pulse_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};