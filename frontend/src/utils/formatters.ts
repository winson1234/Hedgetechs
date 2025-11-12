/**
 * Utility functions for formatting values
 */

/**
 * Format balance for display
 * @param amount - The balance amount
 * @param currency - The currency code
 * @returns Formatted string like "1,000.00 USD"
 */
export const formatBalance = (amount: number, currency: string): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${formatter.format(amount)} ${currency}`;
};

/**
 * Get balance amount for a specific currency from Balance[] array
 * @param balances - Array of balances
 * @param currency - Currency to find
 * @returns The amount, or 0 if not found
 */
export const getBalanceAmount = (
  balances: Array<{ currency: string; amount: number }>,
  currency: string
): number => {
  const balance = balances.find(b => b.currency === currency);
  return balance ? balance.amount : 0;
};

/**
 * Convert Balance[] array to Record<string, number> for easier access
 * @param balances - Array of balances
 * @returns Object with currency as key and amount as value
 */
export const balancesToRecord = (
  balances: Array<{ currency: string; amount: number }>
): Record<string, number> => {
  const record: Record<string, number> = {};
  balances.forEach(b => {
    record[b.currency] = b.amount;
  });
  return record;
};
