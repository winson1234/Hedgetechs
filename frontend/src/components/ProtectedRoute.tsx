import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../store';
import { useEffect, useState } from 'react';

export default function ProtectedRoute() {
  const { user, loading } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const [isInitialMount, setIsInitialMount] = useState(true);
  const isLoggedIn = !!user;
  const isLoading = loading;

  // Check if we have a token in sessionStorage (indicates user might be logged in)
  const hasToken = typeof window !== 'undefined' && !!sessionStorage.getItem('auth_token');

  // Track initial mount - wait for first auth validation to complete
  useEffect(() => {
    // On initial mount, if we have a token, wait for validation
    if (isInitialMount && hasToken) {
      // Wait until loading completes
      if (!loading) {
        // Small delay to ensure Redux state is fully updated
        const timer = setTimeout(() => {
          setIsInitialMount(false);
        }, 100);
        return () => clearTimeout(timer);
      }
    } else if (isInitialMount && !hasToken) {
      // No token, can proceed immediately
      setIsInitialMount(false);
    }
  }, [isInitialMount, hasToken, loading]);

  // Show loading state while:
  // 1. Currently loading, OR
  // 2. Initial mount with token but validation not complete yet
  if (isLoading || (isInitialMount && hasToken)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect to login if validation is complete and user is not logged in
  if (!isInitialMount && !isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Render child routes if authenticated
  return <Outlet />;
}
