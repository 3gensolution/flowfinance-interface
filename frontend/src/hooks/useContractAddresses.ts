'use client';

import { useMemo } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import {
  getContractAddresses,
  getTokenListForChain,
  getTokenByAddressForChain,
  getTokenBySymbolForChain,
  type ContractAddresses,
} from '@/config/contracts';
import { Address } from 'viem';

/**
 * Hook that returns the contract addresses for the currently selected network.
 * Use this instead of importing CONTRACT_ADDRESSES directly.
 */
export function useContractAddresses(): ContractAddresses {
  const { selectedNetwork } = useNetwork();
  return useMemo(() => getContractAddresses(selectedNetwork.id), [selectedNetwork.id]);
}

/**
 * Hook that returns the current chain ID from the selected network.
 */
export function useSelectedChainId(): number {
  const { selectedNetwork } = useNetwork();
  return selectedNetwork.id;
}

/**
 * Hook that returns the token list for the currently selected network.
 */
export function useChainTokenList() {
  const { selectedNetwork } = useNetwork();
  return useMemo(() => getTokenListForChain(selectedNetwork.id), [selectedNetwork.id]);
}

/**
 * Hook that returns a chain-aware getTokenByAddress function.
 */
export function useGetTokenByAddress() {
  const { selectedNetwork } = useNetwork();
  return useMemo(
    () => (address: Address | undefined) => getTokenByAddressForChain(address, selectedNetwork.id),
    [selectedNetwork.id]
  );
}

/**
 * Hook that returns a chain-aware getTokenBySymbol function.
 */
export function useGetTokenBySymbol() {
  const { selectedNetwork } = useNetwork();
  return useMemo(
    () => (symbol: string) => getTokenBySymbolForChain(symbol, selectedNetwork.id),
    [selectedNetwork.id]
  );
}
