import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On load, if a token exists, hydrate the user from /auth/me.
  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('lms_token'))
      .finally(() => setLoading(false));
  }, []);

  function persist({ token, user }) {
    localStorage.setItem('lms_token', token);
    setUser(user);
  }

  const value = {
    user,
    loading,
    isInstructor: user?.role === 'instructor',
    isStudent: user?.role === 'student',
    async login(payload) {
      persist(await api.login(payload));
    },
    async signup(payload) {
      persist(await api.signup(payload));
    },
    logout() {
      localStorage.removeItem('lms_token');
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
