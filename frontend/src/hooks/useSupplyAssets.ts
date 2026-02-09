'use client';

import { useMemo } from 'react';
import { useAccount, useReadContracts, useBalance } from 'wagmi';
import { Address, Abi } from 'viem';
import { TOKEN_LIST, SUPPORTED_TOKENS } from '@/config/contracts';
import {
  SUPPORTED_FIAT_CURRENCIES,
  useSupplierBalances,
  useSupplierVerification,
  getCurrencySymbol,
} from './useFiatOracle';
import { formatTokenAmount } from '@/lib/utils';
import ERC20ABIJson from '@/contracts/ERC20ABI.json';

const ERC20ABI = ERC20ABIJson as Abi;

/**
 * Hook to check if current user is a verified supplier
 */
export function useIsVerifiedSupplier() {
  const { address, isConnected } = useAccount();
  const { data: isVerified, isLoading } = useSupplierVerification(address);

  return {
    isVerified: isVerified as boolean | undefined,
    isLoading,
    isConnected,
  };
}

// Types
export interface CryptoAsset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  balance: string;
  rawBalance: bigint;
  hasBalance: boolean;
  isLoading: boolean;
}

export interface FiatAsset {
  code: string;
  name: string;
  symbol: string;
  balance: string;
  rawBalance: bigint;
  hasBalance: boolean;
  isLoading: boolean;
}

/**
 * Hook to fetch supported crypto tokens with user balances
 * Returns formatted balances ready for display
 */
export function useCryptoAssets() {
  const { address, isConnected } = useAccount();

  // Get native ETH balance
  const { data: ethBalance, isLoading: isEthLoading } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  // Prepare contract calls for all ERC20 token balances
  const tokenContracts = useMemo(() => {
    if (!address) return [];
    return TOKEN_LIST.map((token) => ({
      address: token.address,
      abi: ERC20ABI,
      functionName: 'balanceOf' as const,
      args: [address] as const,
    }));
  }, [address]);

  // Batch fetch all token balances
  const { data: balancesData, isLoading: isTokensLoading } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: isConnected && tokenContracts.length > 0 },
  });

  // Transform data into CryptoAsset format
  const assets: CryptoAsset[] = useMemo(() => {
    const result: CryptoAsset[] = [];

    // Add native ETH first
    const ethRawBalance = ethBalance?.value ?? BigInt(0);
    result.push({
      symbol: SUPPORTED_TOKENS.ETH.symbol,
      name: SUPPORTED_TOKENS.ETH.name,
      address: SUPPORTED_TOKENS.ETH.address,
      decimals: SUPPORTED_TOKENS.ETH.decimals,
      balance: ethBalance ? formatTokenAmount(ethBalance.value, 18, 4) : '0',
      rawBalance: ethRawBalance,
      hasBalance: ethRawBalance > BigInt(0),
      isLoading: isEthLoading,
    });

    // Add ERC20 tokens
    TOKEN_LIST.forEach((token, index) => {
      const balanceResult = balancesData?.[index];
      const rawBalance =
        balanceResult?.status === 'success'
          ? (balanceResult.result as bigint)
          : BigInt(0);

      result.push({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        balance: formatTokenAmount(rawBalance, token.decimals, 4),
        rawBalance,
        hasBalance: rawBalance > BigInt(0),
        isLoading: isTokensLoading,
      });
    });

    return result;
  }, [ethBalance, isEthLoading, balancesData, isTokensLoading]);

  return {
    assets,
    isLoading: isEthLoading || isTokensLoading,
    isConnected,
  };
}

/**
 * Hook to fetch supported fiat currencies with supplier balances
 * Returns formatted balances ready for display
 */
export function useFiatAssets() {
  const { address, isConnected } = useAccount();

  // Batch fetch all fiat balances using existing hook
  const { data: balances, isLoading } = useSupplierBalances(address);

  // Transform data into FiatAsset format
  const assets: FiatAsset[] = useMemo(() => {
    return SUPPORTED_FIAT_CURRENCIES.map((currency) => {
      const rawBalance = balances?.[currency.code] ?? BigInt(0);
      // Fiat balances are stored in cents (2 decimals)
      const formattedBalance =
        rawBalance > BigInt(0)
          ? (Number(rawBalance) / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '0.00';

      return {
        code: currency.code,
        name: currency.name,
        symbol: getCurrencySymbol(currency.code),
        balance: formattedBalance,
        rawBalance,
        hasBalance: rawBalance > BigInt(0),
        isLoading,
      };
    });
  }, [balances, isLoading]);

  return {
    assets,
    isLoading,
    isConnected,
  };
}

/**
 * Get a specific crypto asset by symbol
 */
export function useCryptoAssetBySymbol(symbol: string) {
  const { assets, isLoading, isConnected } = useCryptoAssets();
  const asset = useMemo(
    () => assets.find((a) => a.symbol === symbol),
    [assets, symbol]
  );
  return { asset, isLoading, isConnected };
}

/**
 * Get a specific fiat asset by code
 */
export function useFiatAssetByCode(code: string) {
  const { assets, isLoading, isConnected } = useFiatAssets();
  const asset = useMemo(
    () => assets.find((a) => a.code === code),
    [assets, code]
  );
  return { asset, isLoading, isConnected };
}
