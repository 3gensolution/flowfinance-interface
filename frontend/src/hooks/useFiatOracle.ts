'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES, isFiatSupportedOnActiveChain } from '@/config/contracts';
import FiatOracleABIJson from '@/contracts/FiatOracleABI.json';

const FiatOracleABI = FiatOracleABIJson as Abi;

// Supported fiat currencies
export const SUPPORTED_FIAT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
] as const;

// Get currency symbol helper
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_FIAT_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || currencyCode;
}

// Get currency name helper
export function getCurrencyName(currencyCode: string): string {
  const currency = SUPPORTED_FIAT_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.name || currencyCode;
}

// Get exchange rate for a currency (units per 1 USD, scaled by 1e8)
export function useExchangeRate(currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'exchangeRatesPerUSD',
    args: [currency],
    query: {
      enabled: !!currency && fiatSupported,
    },
  });
}

// Get all supported currencies from contract
export function useSupportedCurrencies() {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'supportedCurrencies',
    query: {
      enabled: fiatSupported,
    },
  });
}

// Get exchange rate update timestamp
export function useExchangeRateUpdateTime(currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'exchangeRateUpdatedAt',
    args: [currency],
    query: {
      enabled: !!currency && fiatSupported,
    },
  });
}

// Get supplier's fiat balance for a specific currency
export function useSupplierBalance(supplier: Address | undefined, currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'supplierBalances',
    args: supplier && currency ? [supplier, currency] : undefined,
    query: {
      enabled: !!supplier && !!currency && fiatSupported,
    },
  });
}

// Get supplier verification status (only queries on fiat-supported chains)
export function useSupplierVerification(supplier: Address | undefined) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'isSupplierVerified',
    args: supplier ? [supplier] : undefined,
    query: {
      enabled: !!supplier && fiatSupported,
    },
  });
}

// Batch fetch exchange rates for all supported currencies
export function useBatchExchangeRates() {
  const fiatSupported = isFiatSupportedOnActiveChain();
  const currencies = SUPPORTED_FIAT_CURRENCIES.map(c => c.code);

  const { data: ratesData, isLoading, isError, refetch } = useReadContracts({
    contracts: currencies.map((currency) => ({
      address: CONTRACT_ADDRESSES.fiatOracle,
      abi: FiatOracleABI,
      functionName: 'exchangeRatesPerUSD',
      args: [currency],
    })),
    query: {
      enabled: fiatSupported,
    },
  });

  const rates = currencies.reduce((acc, currency, index) => {
    const result = ratesData?.[index];
    if (result?.status === 'success' && result.result) {
      acc[currency] = result.result as bigint;
    }
    return acc;
  }, {} as Record<string, bigint>);

  return { data: rates, isLoading, isError, refetch };
}

// Batch fetch supplier balances for all supported currencies
export function useSupplierBalances(supplier: Address | undefined) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  const currencies = SUPPORTED_FIAT_CURRENCIES.map(c => c.code);

  const { data: balancesData, isLoading, isError, refetch } = useReadContracts({
    contracts: currencies.map((currency) => ({
      address: CONTRACT_ADDRESSES.fiatOracle,
      abi: FiatOracleABI,
      functionName: 'supplierBalances',
      args: supplier ? [supplier, currency] : undefined,
    })),
    query: {
      enabled: !!supplier && fiatSupported,
    },
  });

  const balances = currencies.reduce((acc, currency, index) => {
    const result = balancesData?.[index];
    if (result?.status === 'success' && result.result !== undefined) {
      acc[currency] = result.result as bigint;
    }
    return acc;
  }, {} as Record<string, bigint>);

  return { data: balances, isLoading, isError, refetch };
}

// Convert fiat amount to USD cents using exchange rate (client-side helper)
export function convertToUSDCents(amountCents: bigint, exchangeRate: bigint): bigint {
  if (!exchangeRate || exchangeRate === BigInt(0)) return BigInt(0);
  // Formula: USD cents = amount * 1e8 / exchangeRate
  return (amountCents * BigInt(100000000)) / exchangeRate;
}

// Convert USD cents to fiat amount using exchange rate (client-side helper)
export function convertFromUSDCents(usdCents: bigint, exchangeRate: bigint): bigint {
  if (!exchangeRate || exchangeRate === BigInt(0)) return BigInt(0);
  // Formula: amount cents = USD cents * exchangeRate / 1e8
  return (usdCents * exchangeRate) / BigInt(100000000);
}

// Format cents to display value with decimals
export function formatCentsToDecimal(cents: bigint, decimals: number = 2): string {
  const dollars = Number(cents) / 100;
  return dollars.toFixed(decimals);
}

// Format currency with symbol
export function formatCurrency(cents: bigint, currency: string, decimals: number = 2): string {
  const symbol = getCurrencySymbol(currency);
  const value = formatCentsToDecimal(cents, decimals);
  return `${symbol}${value}`;
}

// Format currency in human-readable format with K/M notation for large amounts
export function formatCurrencyHuman(cents: bigint, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const amount = Number(cents) / 100; // Convert cents to dollars/currency units

  if (amount < 1000) {
    // Less than 1,000: show with 2 decimals
    return `${symbol}${amount.toFixed(2)}`;
  } else if (amount < 10000) {
    // 1,000 - 9,999: show with comma and 2 decimals
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (amount < 1000000) {
    // 10,000 - 999,999: show as K with 1 decimal
    return `${symbol}${(amount / 1000).toFixed(1)}K`;
  } else if (amount < 1000000000) {
    // 1M - 999M: show as M with 2 decimals
    return `${symbol}${(amount / 1000000).toFixed(2)}M`;
  } else {
    // 1B+: show as B with 2 decimals
    return `${symbol}${(amount / 1000000000).toFixed(2)}B`;
  }
}

// Check if exchange rate is stale (older than 1 hour) - client-side helper
export function isExchangeRateStale(updatedAt: bigint): boolean {
  if (!updatedAt || updatedAt === BigInt(0)) return true;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneHour = BigInt(3600);
  return (now - updatedAt) > oneHour;
}

// ==================== CONTRACT FUNCTION HOOKS ====================

// Get exchange rate using contract's getExchangeRate function (returns rate and lastUpdated)
export function useGetExchangeRate(currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'getExchangeRate',
    args: [currency],
    query: {
      enabled: !!currency && fiatSupported,
    },
  });
}

// Get supported currencies from contract
export function useGetSupportedCurrencies() {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'getSupportedCurrencies',
    query: {
      enabled: fiatSupported,
    },
  });
}

// Check if exchange rate is stale using contract function
export function useIsExchangeRateStale(currency: string, maxAgeSeconds: number = 3600) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'isExchangeRateStale',
    args: [currency, BigInt(maxAgeSeconds)],
    query: {
      enabled: !!currency && fiatSupported,
    },
  });
}

// Convert USD cents to another currency using contract function
export function useConvertFromUSDCents(usdCents: bigint | undefined, currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'convertFromUSDCents',
    args: usdCents !== undefined ? [usdCents, currency] : undefined,
    query: {
      enabled: usdCents !== undefined && usdCents > BigInt(0) && !!currency && fiatSupported,
    },
  });
}

// Convert currency to USD cents using contract function
export function useConvertToUSDCents(amountCents: bigint | undefined, currency: string) {
  const fiatSupported = isFiatSupportedOnActiveChain();
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatOracle,
    abi: FiatOracleABI,
    functionName: 'convertToUSDCents',
    args: amountCents !== undefined ? [amountCents, currency] : undefined,
    query: {
      enabled: amountCents !== undefined && amountCents > BigInt(0) && !!currency && fiatSupported,
    },
  });
}
