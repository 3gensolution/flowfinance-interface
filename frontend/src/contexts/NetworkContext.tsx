'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CHAIN_CONFIG, CONTRACT_ADDRESSES } from '@/config/contracts';

// Networks with deployed contracts (only these are enabled)
// For now, only Base Sepolia has contracts deployed
export const NETWORKS_WITH_CONTRACTS = [
  CHAIN_CONFIG.baseSepolia.id,
  // Add other network IDs here as contracts are deployed
] as const;

// Check if a network has contracts deployed
export function hasContracts(chainId: number): boolean {
  // Check if chainId is in the list of networks with contracts
  if (NETWORKS_WITH_CONTRACTS.includes(chainId as typeof NETWORKS_WITH_CONTRACTS[number])) {
    return true;
  }

  // Also check if contract addresses are configured (not zero address)
  const isConfigured = CONTRACT_ADDRESSES.loanMarketPlace !== '0x0000000000000000000000000000000000000000';

  // If we're on the network that matches env vars and it's configured, it's available
  if (isConfigured && chainId === CHAIN_CONFIG.baseSepolia.id) {
    return true;
  }

  return false;
}

// Available networks
export const AVAILABLE_NETWORKS = [
  CHAIN_CONFIG.baseSepolia,
  CHAIN_CONFIG.sepolia,
  CHAIN_CONFIG.arbitrumSepolia,
  CHAIN_CONFIG.optimismSepolia,
  CHAIN_CONFIG.base,
  CHAIN_CONFIG.ethereum,
  CHAIN_CONFIG.arbitrum,
  CHAIN_CONFIG.optimism,
  CHAIN_CONFIG.polygon,
] as const;

export type AvailableNetwork = typeof AVAILABLE_NETWORKS[number];

interface NetworkContextType {
  selectedNetwork: AvailableNetwork;
  setSelectedNetwork: (network: AvailableNetwork) => void;
  isTestnet: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  // Default to Base Sepolia
  const [selectedNetwork, setSelectedNetworkState] = useState<AvailableNetwork>(CHAIN_CONFIG.baseSepolia);

  // Determine if current network is testnet
  const testnetIds: number[] = [
    CHAIN_CONFIG.baseSepolia.id,
    CHAIN_CONFIG.sepolia.id,
    CHAIN_CONFIG.arbitrumSepolia.id,
    CHAIN_CONFIG.optimismSepolia.id,
    CHAIN_CONFIG.anvil.id,
  ];
  const isTestnet = testnetIds.includes(selectedNetwork.id);

  // Load saved network from localStorage on mount
  useEffect(() => {
    const savedNetworkId = localStorage.getItem('selectedNetworkId');
    if (savedNetworkId) {
      const network = AVAILABLE_NETWORKS.find(n => n.id === parseInt(savedNetworkId));
      // Only restore if network exists and has contracts
      if (network && hasContracts(network.id)) {
        setSelectedNetworkState(network);
      } else if (network) {
        // If saved network no longer has contracts, fall back to Base Sepolia
        console.warn(`Saved network ${network.name} no longer has contracts. Falling back to Base Sepolia.`);
        localStorage.setItem('selectedNetworkId', CHAIN_CONFIG.baseSepolia.id.toString());
      }
    }
  }, []);

  // Save to localStorage when network changes
  const setSelectedNetwork = useCallback((network: AvailableNetwork) => {
    // Only allow setting networks that have contracts deployed
    if (!hasContracts(network.id)) {
      console.warn(`Network ${network.name} does not have contracts deployed. Cannot switch to this network.`);
      return;
    }
    setSelectedNetworkState(network);
    localStorage.setItem('selectedNetworkId', network.id.toString());
  }, []);

  return (
    <NetworkContext.Provider value={{ selectedNetwork, setSelectedNetwork, isTestnet }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
