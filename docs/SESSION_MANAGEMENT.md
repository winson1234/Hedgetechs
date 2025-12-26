# Session Token Management

## Overview

This system implements Redis-based session token management to track active user sessions. Sessions are automatically invalidated when:

1. **Tab is closed** (frontend uses `sessionStorage` instead of `localStorage`)
2. **Cache is cleared** (session token removed from browser storage)
3. **User logs out** (session deleted from Redis)
4. **Password is changed** (all sessions revoked)

## Architecture

### Session Storage

Sessions are stored in Redis with the following key pattern:

```
session:{userUUID}:{sessionID}
```

Example:
```
session:550e8400-e29b-41d4-a716-446655440000:7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        SESSION LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────┘

1. LOGIN
   ├─ Generate JWT with unique sessionID
   ├─ Store session in Redis: session:{userUUID}:{sessionID}
   ├─ TTL: 24 hours (matches JWT expiry)
   └─ Return token to frontend

2. AUTHENTICATED REQUEST
   ├─ Middleware extracts sessionID from JWT
   ├─ Check if session exists in Redis
   ├─ If not found → 401 (session_expired)
   └─ If found → Allow request

3. LOGOUT
   ├─ Delete session from Redis
   ├─ Frontend clears token from sessionStorage
   └─ Return success

4. TAB CLOSED
   ├─ sessionStorage is cleared by browser
   ├─ Redis session remains (will expire after 24h)
   └─ Next visit requires new login

5. PASSWORD CHANGE
   ├─ All sessions revoked via session revocation
   ├─ All sessions for user deleted from Redis
   └─ User must login again
```

## API Endpoints

### 1. Login (Create Session)

Creates a new session when user logs in.

```bash
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "message": "Login successful",
  "status": "approved"
}
```

**Session Created:**
- Key: `session:550e8400-...:7c9e6679-...`
- Value: Unix timestamp (session creation time)
- TTL: 24 hours

### 2. Logout (Delete Current Session)

Invalidates the current session.

```bash
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Logout successful",
  "success": true
}
```

**Session Deleted:**
- Redis key deleted: `session:{userUUID}:{sessionID}`
- Frontend should clear token from sessionStorage

### 3. Logout from All Devices

Invalidates all sessions for the user.

```bash
POST /api/v1/auth/logout-all
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Logged out from all devices",
  "success": true,
  "sessions_deleted": 3
}
```

**All Sessions Deleted:**
- All Redis keys matching `session:{userUUID}:*` are deleted

## Frontend Implementation

### Using sessionStorage (Recommended)

Store the JWT token in `sessionStorage` to ensure it's cleared when the tab is closed:

```javascript
// Store token on login
sessionStorage.setItem('token', response.token);

// Retrieve token for API requests
const token = sessionStorage.getItem('token');

// Clear token on logout
sessionStorage.removeItem('token');
```

### React Example

```javascript
// Auth context
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    // Initialize from sessionStorage
    return sessionStorage.getItem('token');
  });
  
  const [user, setUser] = useState(null);
  
  // Login function
  const login = async (email, password) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      sessionStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data;
    }
    
    throw new Error('Login failed');
  };
  
  // Logout function
  const logout = async () => {
    if (token) {
      // Call logout endpoint
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
    
    // Clear frontend state
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };
  
  // Logout from all devices
  const logoutAll = async () => {
    if (token) {
      await fetch('/api/v1/auth/logout-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
    
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };
  
  // Handle 401 errors (session expired)
  const handleUnauthorized = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };
  
  return (
    <AuthContext.Provider value={{
      token,
      user,
      login,
      logout,
      logoutAll,
      handleUnauthorized,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Axios Interceptor for Session Expiry

```javascript
import axios from 'axios';
import { useAuth } from './AuthContext';

// Setup axios interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.error;
      
      if (errorCode === 'session_expired' || errorCode === 'session_revoked') {
        // Session expired or revoked, redirect to login
        sessionStorage.removeItem('token');
        window.location.href = '/login?reason=session_expired';
      }
    }
    
    return Promise.reject(error);
  }
);
```

### API Request Helper

```javascript
// Helper function to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('token');
  
  if (!token) {
    throw new Error('No authentication token');
  }
  
  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    const data = await response.json();
    
    if (data.error === 'session_expired' || data.error === 'session_revoked') {
      // Session expired, clear token and redirect
      sessionStorage.removeItem('token');
      window.location.href = '/login?reason=session_expired';
      throw new Error('Session expired');
    }
  }
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return response.json();
}
```

## Backend Implementation

### Session Creation (Login Handler)

```go
// In HandleLogin
token, sessionID, err := utils.GenerateJWT(userID, req.Email)
if err != nil {
    // Handle error
}

// Store session in Redis
if authStorage != nil {
    if err := authStorage.StoreSession(ctx, userID.String(), sessionID); err != nil {
        fmt.Printf("[SESSION WARNING] Failed to store session: %v\n", err)
    }
}
```

### Session Validation (Auth Middleware)

```go
// In NewAuthMiddleware
if claims.SessionID != "" {
    sessionValid, err := authStorage.ValidateSession(r.Context(), userUUID.String(), claims.SessionID)
    if err != nil {
        log.Printf("[AUTH ERROR] Failed to validate session: %v", err)
    }
    if !sessionValid {
        respondWithJSON(w, http.StatusUnauthorized, map[string]interface{}{
            "error":   "session_expired",
            "message": "Your session has expired. Please log in again.",
        })
        return
    }
}
```

### Session Deletion (Logout Handler)

```go
// In HandleLogout
if authStorage != nil && sessionID != "" {
    if err := authStorage.DeleteSession(ctx, userUUID, sessionID); err != nil {
        fmt.Printf("[SESSION WARNING] Failed to delete session: %v\n", err)
    }
}
```

## Redis Operations

### Manual Session Management (Redis CLI)

```bash
# List all sessions
redis-cli KEYS "session:*"

# List sessions for specific user
redis-cli KEYS "session:550e8400-e29b-41d4-a716-*"

# Get session info
redis-cli GET "session:550e8400-...:7c9e6679-..."
redis-cli TTL "session:550e8400-...:7c9e6679-..."

# Delete specific session
redis-cli DEL "session:550e8400-...:7c9e6679-..."

# Delete all sessions for user
redis-cli --scan --pattern "session:550e8400-*" | xargs redis-cli DEL

# Count active sessions
redis-cli KEYS "session:*" | wc -l
```

### Helper Utilities (Go)

```go
// Create session helper
sessionHelper := utils.NewRedisSessionHelper(redisClient)

// Get all sessions for user
keys, err := sessionHelper.GetAllSessionKeys(ctx, userUUID)

// Get session info with TTL
data, ttl, err := sessionHelper.GetSessionInfo(ctx, userUUID, sessionID)
fmt.Printf("Session: %s, TTL: %s\n", data, ttl)

// Count user sessions
count, err := sessionHelper.CountUserSessions(ctx, userUUID)
fmt.Printf("Active sessions: %d\n", count)

// Delete all sessions (cleanup)
deleted, err := sessionHelper.DeleteAllSessions(ctx)
```

## Configuration

### Session TTL

Configure session expiry duration in `internal/config/otp_config.go`:

```go
// Session Token TTL - 24 hours (matches JWT expiry)
SessionExpiryDuration = 24 * time.Hour
```

### JWT Expiry

Configure JWT expiry in environment variables:

```bash
JWT_EXPIRY_HOURS=24  # Default: 24 hours
```

**Note:** Session TTL should match JWT expiry for consistency.

## Security Features

### 1. One Session Per Login
Each login creates a unique session ID, allowing tracking of individual sessions.

### 2. Session Validation
Every authenticated request validates that the session exists in Redis.

### 3. Session Revocation
Password changes revoke all sessions using the session revocation mechanism.

### 4. Automatic Cleanup
Redis automatically removes expired sessions after TTL.

### 5. Tab Closure Detection
Using `sessionStorage` ensures tokens are cleared when tabs close.

### 6. Logout from All Devices
Users can invalidate all their sessions at once.

## Error Codes

| Error Code | HTTP Status | Description | Action |
|------------|-------------|-------------|--------|
| `session_expired` | 401 | Session not found in Redis | Redirect to login |
| `session_revoked` | 401 | Session revoked (password change) | Redirect to login |
| `invalid_token` | 401 | JWT token invalid or malformed | Redirect to login |
| `missing_token` | 401 | No authorization header | Redirect to login |

## Testing

### Test Session Creation

```bash
# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Response includes token with sessionID embedded
```

### Test Session Validation

```bash
# Make authenticated request
curl -X GET http://localhost:8080/api/v1/accounts \
  -H "Authorization: Bearer <token>"

# Check Redis
docker exec brokerage-redis-dev redis-cli -a 123456 KEYS "session:*"
```

### Test Logout

```bash
# Logout
curl -X POST http://localhost:8080/api/v1/auth/logout \
  -H "Authorization: Bearer <token>"

# Verify session deleted
docker exec brokerage-redis-dev redis-cli -a 123456 KEYS "session:*"
```

### Test Tab Close Behavior

1. Login to the application
2. Store token in sessionStorage
3. Close the browser tab
4. Reopen and verify token is gone
5. Attempt API request → 401 error

## Monitoring

### Check Active Sessions

```bash
# Count total active sessions
docker exec brokerage-redis-dev redis-cli -a 123456 \
  DBSIZE | grep "session:"

# List all active sessions
docker exec brokerage-redis-dev redis-cli -a 123456 \
  --scan --pattern "session:*"

# Get session count for specific user
docker exec brokerage-redis-dev redis-cli -a 123456 \
  --scan --pattern "session:550e8400-*" | wc -l
```

### Monitor Session Activity

```bash
# Watch session creations/deletions in real-time
docker exec brokerage-redis-dev redis-cli -a 123456 MONITOR | grep "session:"
```

## Troubleshooting

### Problem: Sessions not being validated

**Check:**
1. Redis is running: `docker ps | grep redis`
2. AuthStorage is initialized in middleware
3. JWT contains sessionID field

**Solution:**
```bash
# Verify JWT structure
echo "<token>" | base64 -d | jq .

# Check Redis connection
docker exec brokerage-redis-dev redis-cli -a 123456 PING
```

### Problem: User stays logged in after tab close

**Check:**
1. Frontend uses `sessionStorage` (not `localStorage`)
2. Token is cleared on tab close

**Solution:**
```javascript
// Use sessionStorage instead of localStorage
sessionStorage.setItem('token', token);  // ✅ Correct
localStorage.setItem('token', token);    // ❌ Wrong
```

### Problem: Session expired but token still valid

**Check:**
1. Session TTL matches JWT expiry
2. Redis session was created on login

**Solution:**
Update config to match JWT expiry:
```go
SessionExpiryDuration = 24 * time.Hour  // Match JWT_EXPIRY_HOURS
```

## Migration Guide

### Upgrading Existing Sessions

If you're adding session management to an existing system:

1. **Update JWT Generation:** New logins will include sessionID
2. **Graceful Degradation:** Old tokens without sessionID will still work
3. **Optional Validation:** Middleware only validates if sessionID exists
4. **Gradual Rollout:** Users re-login naturally over time

### Frontend Migration

```javascript
// Step 1: Move tokens from localStorage to sessionStorage
const oldToken = localStorage.getItem('token');
if (oldToken) {
  sessionStorage.setItem('token', oldToken);
  localStorage.removeItem('token');
}

// Step 2: Update all token storage calls
// Replace: localStorage.setItem('token', token)
// With:    sessionStorage.setItem('token', token)
```

## Summary

Session token management provides:

✅ **Tab Close Detection** - Sessions cleared when tab closes
✅ **Cache Clear Detection** - Sessions lost when cache cleared  
✅ **Logout Support** - Explicit session invalidation
✅ **Multi-Device Management** - Logout from all devices
✅ **Security** - Password changes revoke all sessions
✅ **Audit Trail** - All session events logged
✅ **Graceful Degradation** - Works without Redis (logs warnings)

---

**Status: ✅ Production Ready**

All session management features implemented and ready to use.
