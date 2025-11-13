/**
 * Price formatting utilities for trading platform
 * Handles dynamic precision based on price ranges for different cryptocurrencies
 */

/**
 * Determines the appropriate number of decimal places based on price value
 * @param price - The price value to format
 * @returns Number of decimal places to use
 */
export function getPricePrecision(price: number): number {
  if (price >= 1000) return 2;      // BTC, ETH: $60,000.12
  if (price >= 1) return 3;         // SOL, BNB, AVAX: $100.123
  if (price >= 0.01) return 4;      // DOGE, ADA: $0.1234
  if (price >= 0.0001) return 6;    // Lower value coins: $0.001234
  return 8;                          // SHIB and very low value: $0.00001234
}

/**
 * Formats a price with appropriate precision
 * @param price - The price to format
 * @param forcePrecision - Optional: force specific precision (overrides automatic)
 * @returns Formatted price string
 */
export function formatPrice(price: number | string, forcePrecision?: number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return '0.00';
  }

  const precision = forcePrecision !== undefined ? forcePrecision : getPricePrecision(numPrice);
  return numPrice.toFixed(precision);
}

/**
 * Determines quantity/amount precision based on value
 * @param amount - The amount value
 * @returns Number of decimal places to use
 */
export function getQuantityPrecision(amount: number): number {
  if (amount >= 1000) return 2;     // Large amounts: 1000.12
  if (amount >= 1) return 4;        // Standard: 10.1234
  if (amount >= 0.001) return 6;    // Small: 0.001234
  if (amount >= 0.00001) return 8;  // Very small: 0.00001234
  return 12;                         // Extremely small: show up to 12 decimals
}

/**
 * Formats a quantity/amount with appropriate precision
 * Removes trailing zeros for cleaner display
 * @param amount - The amount to format
 * @param forcePrecision - Optional: force specific precision
 * @returns Formatted amount string
 */
export function formatQuantity(amount: number | string, forcePrecision?: number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || numAmount === 0) {
    return '0.0000';
  }

  const precision = forcePrecision !== undefined ? forcePrecision : getQuantityPrecision(numAmount);
  const formatted = numAmount.toFixed(precision);
  
  // Remove trailing zeros but keep at least one decimal place
  return formatted.replace(/\.?0+$/, match => match.includes('.') ? '.0' : '');
}

/**
 * Formats percentage change with sign and color indicator
 * @param change - The percentage change value
 * @returns Object with formatted string and color class
 */
export function formatPercentChange(change: number): { text: string; isPositive: boolean } {
  const sign = change >= 0 ? '+' : '';
  return {
    text: `${sign}${change.toFixed(2)}%`,
    isPositive: change >= 0,
  };
}
