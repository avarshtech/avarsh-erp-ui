import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

/**
 * Protected Route wrapper component
 * Redirects to login page if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
