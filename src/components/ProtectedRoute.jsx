import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { isAuthenticated, initializeSession } from '../services/auth/authService';
import { hasSessionActiveFlag } from '../services/auth/sessionStore';

/**
 * Protected Route wrapper component.
 *
 * Three states:
 * - 'authenticated'   — token is valid in memory, render children immediately
 * - 'initializing'    — no in-memory token but sessionActive flag exists;
 *                        attempting silent refresh via HttpOnly cookie
 * - 'unauthenticated' — no token, no flag; redirect to login
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  const [authState, setAuthState] = useState(() => {
    // Synchronous fast path: token already in memory (normal SPA navigation)
    if (isAuthenticated()) return 'authenticated';
    // Session flag means a refresh cookie likely exists (page refresh / F5)
    if (hasSessionActiveFlag()) return 'initializing';
    // No token, no flag — unauthenticated
    return 'unauthenticated';
  });

  useEffect(() => {
    if (authState !== 'initializing') return;

    let cancelled = false;

    initializeSession().then((success) => {
      if (cancelled) return;
      setAuthState(success ? 'authenticated' : 'unauthenticated');
    });

    return () => { cancelled = true; };
  }, [authState]);

  if (authState === 'initializing') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
