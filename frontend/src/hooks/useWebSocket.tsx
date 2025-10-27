// Deprecated hook — replaced by WebSocketProvider (src/context/WebSocketContext.tsx)
// Kept as a no-op shim for compatibility. Please migrate to WebSocketContext.

export type PriceMessage = {
  symbol: string
  price: string | number
  time: number
}

export function useWebSocket() {
  console.warn('useWebSocket is deprecated; use WebSocketContext instead')
  return { lastMessage: null as PriceMessage | null }
}

export default useWebSocket
