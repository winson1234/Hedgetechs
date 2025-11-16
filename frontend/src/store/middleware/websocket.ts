import { Middleware } from '@reduxjs/toolkit';
import { updateCurrentPrice, updateOrderBook, addTrade } from '../slices/priceSlice';
import { createDeposit } from '../slices/transactionSlice';
import { fetchAccounts } from '../slices/accountSlice';
import { addToast } from '../slices/uiSlice';
import { updateForexQuote } from '../slices/forexSlice';

// WebSocket connection instance
let ws: WebSocket | null = null;
let reconnectTimeout: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

// Throttling for trade updates to prevent buffer overflow
const TRADE_THROTTLE_MS = 100; // Only update trades every 100ms
const tradeThrottleTimers: Record<string, number> = {};
const pendingTrades: Record<string, { price: number; quantity: number; time: number; isBuyerMaker: boolean }> = {};

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

        // Handle crypto deposit completion messages from Coinbase webhook
        if (data.type === 'DEPOSIT_COMPLETED') {
          const payload = data.payload;
          if (!payload) return;

          const accountId = payload.accountId;
          const amount = parseFloat(payload.amount);
          const currency = payload.currency;
          const paymentIntentId = payload.paymentIntentId;

          // Dispatch createDeposit thunk to create the deposit transaction
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (store.dispatch as any)(createDeposit({
            accountId,
            amount,
            currency,
            paymentIntentId,
            metadata: payload.method ? { cardBrand: payload.method } : undefined
          }))
            .unwrap()
            .then(() => {
              store.dispatch(addToast({
                type: 'success',
                message: `Crypto deposit of ${amount} ${currency} completed!`,
                duration: 5000
              }));

              // Refresh accounts to get updated balances
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (store.dispatch as any)(fetchAccounts()).catch((err: unknown) => {
                console.error('Failed to fetch accounts:', err);
              });

              // Clear pending deposit from localStorage
              localStorage.removeItem('pending_crypto_deposit');
            })
            .catch((error: unknown) => {
              console.error('Failed to process crypto deposit:', error);
              store.dispatch(addToast({
                type: 'error',
                message: 'Failed to process crypto deposit',
                duration: 5000
              }));
            });

          return; // Don't process as price message
        }

        // Handle different message types based on our backend format
        if (data.type === 'forex_quote') {
          // Forex quote message: { type: "forex_quote", symbol, bid, ask, timestamp }
          const symbol = data.symbol;
          const bid = typeof data.bid === 'string' ? parseFloat(data.bid) : data.bid;
          const ask = typeof data.ask === 'string' ? parseFloat(data.ask) : data.ask;
          const timestamp = data.timestamp;

          store.dispatch(
            updateForexQuote({
              symbol,
              bid,
              ask,
              timestamp,
            })
          );
        } else if (data.symbol && data.bids && data.asks) {
          // Order book message: { symbol, bids: [[price, qty], ...], asks: [[price, qty], ...] }
          const symbol = data.symbol;
          const bids = data.bids.slice(0, 10).map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));
          const asks = data.asks.slice(0, 10).map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));

          store.dispatch(
            updateOrderBook({
              symbol,
              bids,
              asks,
            })
          );
        } else if (data.symbol && data.price && data.time) {
          // Trade message: { symbol, price, time, quantity?, isBuyerMaker? }
          const symbol = data.symbol;
          const price = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
          const quantity = typeof data.quantity === 'string' ? parseFloat(data.quantity) : data.quantity || 0;
          const timestamp = data.time;
          const isBuyerMaker = data.isBuyerMaker || false;

          // Always update current price immediately (for chart)
          store.dispatch(
            updateCurrentPrice({
              symbol,
              price,
              timestamp,
            })
          );

          // Throttle trade history updates to prevent buffer overflow
          // Store the latest trade for this symbol
          pendingTrades[symbol] = {
            price,
            quantity,
            time: timestamp,
            isBuyerMaker,
          };

          // Only dispatch trade updates every TRADE_THROTTLE_MS
          if (!tradeThrottleTimers[symbol]) {
            tradeThrottleTimers[symbol] = window.setTimeout(() => {
              const trade = pendingTrades[symbol];
              if (trade) {
                store.dispatch(
                  addTrade({
                    symbol,
                    trade,
                  })
                );
                delete pendingTrades[symbol];
              }
              tradeThrottleTimers[symbol] = 0;
            }, TRADE_THROTTLE_MS);
          }
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
        }, delay) as unknown as number;
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
