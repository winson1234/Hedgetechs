// Global asset color mapping for consistent colors across charts
// This ensures each asset always has the same color regardless of portfolio composition

export const ASSET_COLORS: Record<string, string> = {
  // Cryptocurrencies
  BTC: '#f59e0b',    // amber - Bitcoin
  ETH: '#6366f1',    // indigo - Ethereum
  SOL: '#14b8a6',    // teal - Solana

  // Fiat Currencies
  USD: '#10b981',    // green - US Dollar
  EUR: '#3b82f6',    // blue - Euro
  MYR: '#8b5cf6',    // purple - Malaysian Ringgit
  JPY: '#ef4444',    // red - Japanese Yen
};

// Fallback color for unmapped assets
export const FALLBACK_COLOR = '#94a3b8'; // slate-400

// Helper function to get color for an asset
export const getAssetColor = (asset: string): string => {
  return ASSET_COLORS[asset] || FALLBACK_COLOR;
};
