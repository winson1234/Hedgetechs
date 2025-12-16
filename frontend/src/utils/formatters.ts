/**
 * Centralized utility functions for formatting values
 * This is the single source of truth for all formatting across the app
 */

// ============================================================================
// CURRENCY & NUMBER FORMATTING
// ============================================================================

/**
 * Format balance for display (decimal style with currency code)
 * @param amount - The balance amount
 * @param currency - The currency code
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "1,000.00 USD"
 */
export const formatBalance = (amount: number, currency: string, decimals: number = 2): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return `0.${'0'.repeat(decimals)} ${currency}`;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formatter.format(amount)} ${currency}`;
};

/**
 * Format value with currency symbol (e.g., "$1,000.00")
 * @param value - The numeric value to format
 * @param currency - The currency code (e.g., 'USD', 'EUR')
 * @returns Formatted string with currency symbol
 */
export const formatCurrency = (value: number | undefined, currency: string | undefined): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
};

/**
 * Format a number with specific decimal places
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format a percentage value
 * @param value - The numeric value to format (0.05 = 5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % symbol
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format date for display
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

// ============================================================================
// BALANCE HELPERS
// ============================================================================

/**
 * Get balance amount for a specific currency from Balance[] array
 * @param balances - Array of balances
 * @param currency - Currency to find
 * @returns The amount, or 0 if not found
 */
export const getBalanceAmount = (
  balances: Array<{ currency: string; amount: number }> | undefined,
  currency: string
): number => {
  if (!balances) return 0;
  const balance = balances.find(b => b.currency === currency);
  return balance ? balance.amount : 0;
};

/**
 * Convert Balance[] array to Record<string, number> for easier access
 * @param balances - Array of balances
 * @returns Object with currency as key and amount as value
 */
export const balancesToRecord = (
  balances: Array<{ currency: string; amount: number }> | undefined
): Record<string, number> => {
  const record: Record<string, number> = {};
  if (!balances) return record;
  balances.forEach(b => {
    record[b.currency] = b.amount;
  });
  return record;
};

// ============================================================================
// ACCOUNT FORMATTING
// ============================================================================

/**
 * Format account ID for display
 * Demo accounts: padded with leading zeros to 5 digits (e.g., 00001, 00002)
 * Live accounts: displayed as-is (e.g., 10001, 10002)
 * @param accountId - Account ID number
 * @param accountType - Account type ('live' or 'demo')
 * @returns Formatted account ID string
 */
export const formatAccountId = (accountId: number | string | undefined, accountType?: 'live' | 'demo'): string => {
  if (accountId === undefined || accountId === null) return '';
  
  const id = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
  if (isNaN(id)) return accountId.toString();

  // If accountType is provided, use it; otherwise infer from ID range
  const isLive = accountType === 'live' || (accountType === undefined && id >= 10001 && id <= 19999);
  
  if (isLive) {
    // Live accounts: display as-is (10001, 10002, etc.)
    return id.toString();
  } else {
    // Demo accounts: pad with leading zeros to 5 digits (00001, 00002, etc.)
    return id.toString().padStart(5, '0');
  }
};

/**
 * Format account number for display
 * @param accountNumber - Full account number (e.g., 1000001)
 * @param obfuscate - Whether to show only last 3 digits (e.g., "****001")
 * @returns Formatted account number string
 */
export const formatAccountNumber = (accountNumber: string | number, obfuscate: boolean = false): string => {
  if (!accountNumber) return '';

  const accountStr = accountNumber.toString();

  if (obfuscate) {
    const lastThree = accountStr.slice(-3);
    return `****${lastThree}`;
  }

  return accountStr;
};

/**
 * Get display name for an account
 * Priority: nickname > "Account {number}"
 * @param account - Account object with optional nickname
 * @returns Display-friendly account name
 */
export const getAccountDisplayName = (account: {
  account_number: number;
  nickname?: string | null;
}): string => {
  if (account.nickname) {
    return account.nickname;
  }
  return `Account ${account.account_number}`;
};

/**
 * Get full account display with number in parentheses
 * Format: "Nickname (1000001)" or "Account 1000001"
 * @param account - Account object
 * @param showNumber - Whether to show account number in parentheses
 * @returns Full display string
 */
export const getAccountFullDisplay = (
  account: {
    account_number: number;
    nickname?: string | null;
  },
  showNumber: boolean = true
): string => {
  const name = account.nickname || `Account ${account.account_number}`;

  if (showNumber && account.nickname) {
    return `${name} (${account.account_number})`;
  }

  return name;
};

/**
 * Format account type for display
 * @param type - Account type ("live" or "demo")
 * @returns Capitalized type
 */
export const formatAccountType = (type: 'live' | 'demo'): string => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

/**
 * Format product type for display
 * @param productType - Product type ("spot", "cfd", or "futures")
 * @returns Human-readable product type
 */
export const formatProductType = (productType: 'spot' | 'cfd' | 'futures'): string => {
  const map: Record<typeof productType, string> = {
    spot: 'Spot Trading',
    cfd: 'CFD Trading',
    futures: 'Futures Trading',
  };
  return map[productType] || productType;
};

/**
 * Get account color or default
 * @param color - Optional hex color from account
 * @returns Hex color string
 */
export const getAccountColor = (color?: string | null): string => {
  return color || '#6366f1'; // Default indigo-500
};

/**
 * Get account icon or default
 * @param icon - Optional icon identifier from account
 * @returns Icon identifier string
 */
export const getAccountIcon = (icon?: string | null): string => {
  return icon || 'wallet'; // Default wallet icon
};

/**
 * Get account status badge color
 * @param status - Account status
 * @returns Tailwind color class
 */
export const getAccountStatusColor = (status: 'active' | 'deactivated' | 'suspended'): string => {
  const colors: Record<typeof status, string> = {
    active: 'bg-green-500',
    deactivated: 'bg-gray-500',
    suspended: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
};

/**
 * Determine if account is a live account (vs demo)
 * Based on account number range: 1000000-4999999 = live, 5000000-9999999 = demo
 * @param accountNumber - Account number
 * @returns true if live account
 */
export const isLiveAccount = (accountNumber: number): boolean => {
  return accountNumber >= 1000000 && accountNumber < 5000000;
};

/**
 * Generate account initials for avatar/icon
 * @param accountNumber - Account number
 * @param nickname - Optional nickname
 * @returns 2-character initials
 */
export const getAccountInitials = (accountNumber: number, nickname?: string | null): string => {
  if (nickname) {
    const words = nickname.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return nickname.slice(0, 2).toUpperCase();
  }

  // For account numbers, use last 2 digits
  return accountNumber.toString().slice(-2);
};
