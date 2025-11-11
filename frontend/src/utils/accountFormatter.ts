// Account formatting utilities

/**
 * Format account number for display
 * @param accountNumber - Full account number (e.g., "1000001")
 * @param obfuscate - Whether to show only last 3 digits (e.g., "****001")
 * @returns Formatted account number string
 */
export function formatAccountNumber(accountNumber: string, obfuscate: boolean = false): string {
  if (!accountNumber) return '';

  if (obfuscate) {
    // Show last 3 digits only
    const lastThree = accountNumber.slice(-3);
    return `****${lastThree}`;
  }

  // Return full account number
  return accountNumber;
}

/**
 * Get display name for an account
 * Priority: nickname > "Account {number}"
 * @param account - Account object with optional nickname
 * @returns Display-friendly account name
 */
export function getAccountDisplayName(account: {
  account_number: string;
  nickname?: string | null;
}): string {
  if (account.nickname) {
    return account.nickname;
  }
  return `Account ${account.account_number}`;
}

/**
 * Get full account display with number in parentheses
 * Format: "Nickname (1000001)" or "Account 1000001"
 * @param account - Account object
 * @param showNumber - Whether to show account number in parentheses
 * @returns Full display string
 */
export function getAccountFullDisplay(
  account: {
    account_number: string;
    nickname?: string | null;
  },
  showNumber: boolean = true
): string {
  const name = account.nickname || `Account ${account.account_number}`;

  if (showNumber && account.nickname) {
    return `${name} (${account.account_number})`;
  }

  return name;
}

/**
 * Format account type for display
 * @param type - Account type ("live" or "demo")
 * @returns Capitalized type
 */
export function formatAccountType(type: 'live' | 'demo'): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format product type for display
 * @param productType - Product type ("spot", "cfd", or "futures")
 * @returns Human-readable product type
 */
export function formatProductType(productType: 'spot' | 'cfd' | 'futures'): string {
  const map: Record<typeof productType, string> = {
    spot: 'Spot Trading',
    cfd: 'CFD Trading',
    futures: 'Futures Trading',
  };
  return map[productType] || productType;
}

/**
 * Get account color or default
 * @param color - Optional hex color from account
 * @returns Hex color string
 */
export function getAccountColor(color?: string | null): string {
  return color || '#6366f1'; // Default indigo-500
}

/**
 * Get account icon or default
 * @param icon - Optional icon identifier from account
 * @returns Icon identifier string
 */
export function getAccountIcon(icon?: string | null): string {
  return icon || 'wallet'; // Default wallet icon
}

/**
 * Format balance for display
 * @param amount - Balance amount
 * @param currency - Currency code
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted balance string
 */
export function formatBalance(amount: number, currency: string, decimals: number = 2): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

/**
 * Get account status badge color
 * @param status - Account status
 * @returns Tailwind color class
 */
export function getAccountStatusColor(status: 'active' | 'deactivated' | 'suspended'): string {
  const colors: Record<typeof status, string> = {
    active: 'bg-green-500',
    deactivated: 'bg-gray-500',
    suspended: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Determine if account is a live account (vs demo)
 * Based on account number range: 1000000-4999999 = live, 5000000-9999999 = demo
 * @param accountNumber - Account number string
 * @returns true if live account
 */
export function isLiveAccount(accountNumber: string): boolean {
  const num = parseInt(accountNumber, 10);
  return num >= 1000000 && num < 5000000;
}

/**
 * Generate account initials for avatar/icon
 * @param accountNumber - Account number
 * @param nickname - Optional nickname
 * @returns 2-character initials
 */
export function getAccountInitials(accountNumber: string, nickname?: string | null): string {
  if (nickname) {
    const words = nickname.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return nickname.slice(0, 2).toUpperCase();
  }

  // For account numbers, use last 2 digits
  return accountNumber.slice(-2);
}
