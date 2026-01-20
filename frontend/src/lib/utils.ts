import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits, parseUnits, Address } from 'viem';
import { getTokenByAddress } from '@/config/contracts';

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

// Get token symbol from address
export function getTokenSymbol(address: Address | undefined): string {
  if (!address) return 'UNKNOWN';
  const token = getTokenByAddress(address);
  return token?.symbol || formatAddress(address, 3);
}

// Get token decimals from address
export function getTokenDecimals(address: Address | undefined): number {
  if (!address) return 18;
  const token = getTokenByAddress(address);
  return token?.decimals || 18;
}

// Calculate health factor color
export function getHealthFactorColor(healthFactor: bigint): string {
  const factor = Number(healthFactor);
  if (factor >= 15000) return 'text-green-400';
  if (factor >= 12000) return 'text-yellow-400';
  if (factor >= 10000) return 'text-orange-400';
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
