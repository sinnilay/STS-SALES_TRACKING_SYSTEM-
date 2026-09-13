import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  useEffect(() => {
    // Handle unauthorized event dispatched by the axios interceptor
    const handleUnauthorized = () => {
      logout();
    };

    // Handle a subscription expiring mid-session: mark the user as expired
    // (without logging out) so ProtectedRoute can show the access-denied screen.
    const handleSubscriptionExpired = () => {
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, subscriptionExpired: true };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    window.addEventListener('subscription-expired', handleSubscriptionExpired);
    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
      window.removeEventListener('subscription-expired', handleSubscriptionExpired);
    };
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', jwtToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
