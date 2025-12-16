import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../store/slices/notificationSlice';

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

export default function NotificationBell() {
  const dispatch = useAppDispatch();
  const { notifications, unreadCount, loading } = useAppSelector(state => state.notification);
  const token = useAppSelector(state => state.auth.token);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show notification bell if user is authenticated
  if (!token) {
    return null;
  }

  // Only fetch if user is authenticated
  const isAuthenticated = !!token;

  // Fetch notifications and unread count on mount and when dropdown opens
  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchUnreadCount());
    if (isOpen) {
      dispatch(fetchNotifications(false));
    }
  }, [dispatch, isOpen, isAuthenticated]);

  // Poll for unread count every 30 seconds (only if authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      dispatch(fetchUnreadCount());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch, isAuthenticated]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await dispatch(markNotificationRead(notificationId));
    }
  };

  const handleMarkAllRead = async () => {
    await dispatch(markAllNotificationsRead());
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read).slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 sm:p-2 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        title="Notifications"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-[#00C0A2] hover:text-[#00a085] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                Loading notifications...
              </div>
            ) : unreadNotifications.length === 0 && readNotifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                No notifications
              </div>
            ) : (
              <>
                {/* Unread Notifications */}
                {unreadNotifications.length > 0 && (
                  <div className="border-b border-slate-200 dark:border-slate-700">
                    {unreadNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                        className="p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-2 h-2 bg-[#00C0A2] rounded-full mt-2" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Read Notifications */}
                {readNotifications.length > 0 && (
                  <div>
                    {readNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors opacity-75"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

