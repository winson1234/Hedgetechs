import { apiFetch } from '../../utils/api';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface Notification {
  id: string;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  read_at?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

// Helper to get auth token
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.token || null;
};

// Fetch notifications
export const fetchNotifications = createAsyncThunk(
  'notification/fetchNotifications',
  async (unreadOnly: boolean = false, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) {
        // Silently fail if not authenticated
        return [];
      }

      const url = `api/v1/notifications${unreadOnly ? '?unread_only=true' : ''}`;
      const response = await apiFetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Silently fail - return empty array
        return [];
      }
      const data = await response.json();
      return data.notifications || [];
    } catch (error) {
      // Silently fail - return empty array
      return [];
    }
  }
);

// Fetch unread count
export const fetchUnreadCount = createAsyncThunk(
  'notification/fetchUnreadCount',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) {
        // Silently fail if not authenticated - don't show error
        return 0;
      }

      const response = await apiFetch('api/v1/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Silently fail - don't show error for notifications
        return 0;
      }
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      // Silently fail - don't show error for notifications
      return 0;
    }
  }
);

// Mark notification as read
export const markNotificationRead = createAsyncThunk(
  'notification/markNotificationRead',
  async (notificationId: string, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch(`api/v1/notifications/read?id=${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to mark notification as read');
      return notificationId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
      return rejectWithValue(message);
    }
  }
);

// Mark all notifications as read
export const markAllNotificationsRead = createAsyncThunk(
  'notification/markAllNotificationsRead',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch('api/v1/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
      return rejectWithValue(message);
    }
  }
);

// Notification slice
const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    // Add notification (for real-time updates)
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.is_read) {
        state.unreadCount += 1;
      }
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state) => {
        // Silently handle errors - don't show error, just set empty array
        state.loading = false;
        state.notifications = [];
        state.error = null;
      });

    // Fetch unread count
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(fetchUnreadCount.rejected, (state) => {
        // Silently handle errors - don't update state
        state.unreadCount = 0;
      });

    // Mark notification as read
    builder
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && !notification.is_read) {
          notification.is_read = true;
          notification.read_at = new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });

    // Mark all notifications as read
    builder
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications.forEach(n => {
          n.is_read = true;
          n.read_at = new Date().toISOString();
        });
        state.unreadCount = 0;
      });
  },
});

export const {
  addNotification,
  clearError,
} = notificationSlice.actions;

export default notificationSlice.reducer;

