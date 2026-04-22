import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize - since we don't persist tokens, we just set loading to false instantly
  useEffect(() => {
    setLoading(false);
  }, []);

  const fetchProfile = async (token) => {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Invalid token');
    const userData = await res.json();
    setUser(userData);
  };

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    
    await fetchProfile(data.access_token);
  };

  const signup = async (email, password) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Signup failed');
    
    await login(email, password);
  };

  const googleLogin = async (credentialResponse) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: credentialResponse.credential })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Google auth failed');
    
    await fetchProfile(data.access_token);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
