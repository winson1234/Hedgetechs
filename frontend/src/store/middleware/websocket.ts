import { Middleware } from '@reduxjs/toolkit';
import { updateCurrentPrice, updateOrderBook } from '../slices/priceSlice';

// WebSocket connection instance
let ws: WebSocket | null = null;
let reconnectTimeout: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

// WebSocket middleware for Redux
export const websocketMiddleware: Middleware = (store) => {
  // Function to connect to WebSocket
  const connect = () => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      // Clear any pending reconnect timeouts
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different message types
        if (data.e === 'trade' || data.e === 'aggTrade') {
          // Trade message: Update current price
          const symbol = data.s; // e.g., "BTCUSDT"
          const price = parseFloat(data.p);
          const timestamp = data.T || Date.now();

          store.dispatch(
            updateCurrentPrice({
              symbol,
              price,
              timestamp,
            })
          );
        } else if (data.e === 'depthUpdate') {
          // Order book update
          const symbol = data.s;
          const bids = data.b?.slice(0, 10).map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          })) || [];
          const asks = data.a?.slice(0, 10).map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          })) || [];

          store.dispatch(
            updateOrderBook({
              symbol,
              bids,
              asks,
            })
          );
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
      ws = null;

      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 1000,
          30000 // Max 30 seconds
        );

        console.log(`[WebSocket] Reconnecting in ${Math.round(delay / 1000)}s... (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, delay);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page.');
      }
    };
  };

  // Connect on middleware initialization
  connect();

  // Cleanup function
  window.addEventListener('beforeunload', () => {
    if (ws) {
      ws.close(1000, 'Page unload');
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
  });

  return (next) => (action) => {
    // Pass all actions through (WebSocket is read-only, doesn't intercept actions)
    return next(action);
  };
};

// Export function to manually close WebSocket (for testing or cleanup)
export const closeWebSocket = () => {
  if (ws) {
    ws.close(1000, 'Manual close');
    ws = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
};

// Export function to check WebSocket connection status
export const getWebSocketStatus = (): 'connected' | 'connecting' | 'disconnected' => {
  if (!ws) return 'disconnected';
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'connected';
    default:
      return 'disconnected';
  }
};
