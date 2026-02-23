import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits, Address } from 'viem';
import { getTokenByAddress, getTokenByAddressForChain } from '@/config/contracts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format token amount with decimals
export function formatTokenAmount(
  amount: bigint | undefined,
  decimals: number,
  displayDecimals: number = 4
): string {
  if (amount === undefined || amount === null) return '0';
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  return num.toLocaleString(undefined, {
    maximumFractionDigits: displayDecimals,
    minimumFractionDigits: 0,
  });
}

// Parse token amount string to bigint
export function parseTokenAmount(amount: string, decimals: number): bigint {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return BigInt(0);
  }
}

// Format address for display
export function formatAddress(address: Address, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format USD value
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format percentage (bps to %)
export function formatPercentage(bps: bigint | undefined, decimals: number = 2): string {
  if (bps === undefined || bps === null) return '0%';
  const percentage = Number(bps) / 100;
  return `${percentage.toFixed(decimals)}%`;
}

// Format APY from bps
export function formatAPY(bps: bigint | undefined): string {
  if (bps === undefined || bps === null) return '0% APY';
  const apy = Number(bps) / 100;
  return `${apy.toFixed(2)}% APY`;
}

// Format duration from seconds
export function formatDuration(seconds: bigint | undefined): string {
  if (seconds === undefined || seconds === null) return '0 days';
  const totalSeconds = Number(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return 'Less than 1 hour';
}

// Format relative time
export function formatRelativeTime(timestamp: bigint | undefined): string {
  if (timestamp === undefined || timestamp === null) return 'Unknown';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

// Format time until
export function formatTimeUntil(timestamp: bigint | undefined): string {
  if (timestamp === undefined || timestamp === null) return 'Unknown';
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(timestamp) - now;

  if (diff <= 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

// Get token symbol from address (optionally chain-aware)
export function getTokenSymbol(address: Address | undefined, chainId?: number): string {
  if (!address) return 'UNKNOWN';
  const token = chainId ? getTokenByAddressForChain(address, chainId) : getTokenByAddress(address);
  return token?.symbol || formatAddress(address, 3);
}

// Get token decimals from address (optionally chain-aware)
export function getTokenDecimals(address: Address | undefined, chainId?: number): number {
  if (!address) return 18;
  const token = chainId ? getTokenByAddressForChain(address, chainId) : getTokenByAddress(address);
  return token?.decimals || 18;
}

// Normalize raw health factor from contract (inflated by decimal mismatch)
// The contract's calculateHealthFactor doesn't normalize for differing token decimals,
// so the result is inflated by 10^(collateralDecimals - borrowDecimals).
// Returns health factor as a percentage (e.g., 170 means 170%).
export function normalizeHealthFactor(
  rawValue: bigint,
  collateralDecimals: number,
  borrowDecimals: number
): number {
  const decimalDiff = collateralDecimals - borrowDecimals;
  const divisor = Math.pow(10, decimalDiff);
  // rawValue is in basis points (10000 = 100%) after removing decimal inflation
  return Number(rawValue) / divisor / 100;
}

// Calculate health factor from USD values (for fiat loans computed on frontend)
// Returns ratio (e.g., 1.7 means 170%)
export function calculateHealthFactorFromUSD(
  collateralUSD: number,
  debtUSD: number
): number {
  if (debtUSD <= 0) return 0;
  return collateralUSD / debtUSD;
}

// Calculate health factor color from ratio value (e.g., 1.5 = 150%)
export function getHealthFactorColor(healthFactor: number): string {
  if (healthFactor >= 1.5) return 'text-green-400';
  if (healthFactor >= 1.2) return 'text-yellow-400';
  if (healthFactor >= 1.0) return 'text-orange-400';
  return 'text-red-400';
}

// Calculate LTV from amounts and prices
export function calculateLTV(
  collateralValue: bigint,
  borrowValue: bigint
): number {
  if (collateralValue === BigInt(0)) return 0;
  return (Number(borrowValue) * 10000) / Number(collateralValue);
}

// Days to seconds
export function daysToSeconds(days: number): bigint {
  return BigInt(days * 86400);
}

// Seconds to days
export function secondsToDays(seconds: bigint): number {
  return Number(seconds) / 86400;
}

// Format large numbers with K, M, B suffixes
export function formatCompactNumber(value: number | bigint): string {
  const num = typeof value === 'bigint' ? Number(value) : value;

  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return `${sign}${(absNum / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${sign}${(absNum / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 1_000) {
    return `${sign}${(absNum / 1_000).toFixed(1)}K`;
  }

  return `${sign}${absNum.toFixed(0)}`;
}

// Format USD with compact notation and + suffix
export function formatCompactUSD(value: number | bigint): string {
  const num = typeof value === 'bigint' ? Number(value) : value;

  if (num === 0) return '$0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return `${sign}$${(absNum / 1_000_000_000).toFixed(1)}B+`;
  }
  if (absNum >= 1_000_000) {
    return `${sign}$${(absNum / 1_000_000).toFixed(1)}M+`;
  }
  if (absNum >= 10_000) {
    return `${sign}$${(absNum / 1_000).toFixed(0)}K+`;
  }
  if (absNum >= 1_000) {
    return `${sign}$${(absNum / 1_000).toFixed(1)}K+`;
  }

  return `${sign}$${absNum.toFixed(0)}+`;
}

/**
 * Convert fiat amount (in cents) to USD value using the exchange rate stored at creation time.
 * If currency is USD, returns the amount directly.
 * Otherwise, converts using the formula: USD = amount * 1e8 / exchangeRate
 *
 * @param amountCents - The fiat amount in cents
 * @param currency - The currency code (e.g., 'USD', 'NGN', 'EUR')
 * @param exchangeRateAtCreation - The exchange rate at creation time (units per 1 USD, scaled by 1e8)
 * @returns The USD value in dollars (not cents)
 */
export function convertFiatToUSD(
  amountCents: bigint,
  currency: string,
  exchangeRateAtCreation: bigint
): number {
  // If USD, just return the amount in dollars
  if (currency === 'USD') {
    return Number(amountCents) / 100;
  }

  // If no exchange rate stored (legacy loans), return 0 or the original amount
  if (!exchangeRateAtCreation || exchangeRateAtCreation === BigInt(0)) {
    return Number(amountCents) / 100;
  }

  // Convert to USD: amount * 1e8 / exchangeRate
  const usdCents = (amountCents * BigInt(100000000)) / exchangeRateAtCreation;
  return Number(usdCents) / 100;
}
