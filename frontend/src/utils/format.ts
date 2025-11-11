/**
 * Format a balance value with currency symbol
 * @param value - The numeric value to format (defaults to 0 if undefined)
 * @param currency - The currency code (e.g., 'USD', 'EUR', 'GBP') (defaults to 'USD' if undefined)
 * @returns Formatted string with currency symbol
 */
export function formatBalance(value: number | undefined, currency: string | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/**
 * Format a number with specific decimal places
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value - The numeric value to format (0.05 = 5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % symbol
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
