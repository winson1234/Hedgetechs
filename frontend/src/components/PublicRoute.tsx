import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../store';

export default function PublicRoute() {
  const { user, loading } = useAppSelector((state) => state.auth);
  const isLoggedIn = !!user;
  const isLoading = loading;

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to dashboard if already authenticated
  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render child routes if not authenticated
  return <Outlet />;
}
