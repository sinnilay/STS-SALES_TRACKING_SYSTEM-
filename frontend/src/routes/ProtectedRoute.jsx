import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSubscriptionExpired } from '../utils/subscription';
import SubscriptionExpired from '../pages/SubscriptionExpired';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // If they are a Sales user trying to access an Admin route, send them to their dashboard
    if (user?.role === 'Sales') {
      return <Navigate to="/sales" replace />;
    }
    // Fallback redirect
    return <Navigate to="/login" replace />;
  }

  if (isSubscriptionExpired(user)) {
    return <SubscriptionExpired />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
