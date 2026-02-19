'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CHAIN_CONFIG, setActiveChainId } from '@/config/contracts';
import { useContractStore } from '@/stores/contractStore';

// Networks with deployed contracts
export const NETWORKS_WITH_CONTRACTS = [
  CHAIN_CONFIG.baseSepolia.id,
  CHAIN_CONFIG.polygonAmoy.id,
] as const;

// Check if a network has contracts deployed
export function hasContracts(chainId: number): boolean {
  return (NETWORKS_WITH_CONTRACTS as readonly number[]).includes(chainId);
}

// Available networks (networks with contracts listed first)
export const AVAILABLE_NETWORKS = [
  // Networks with contracts first
  CHAIN_CONFIG.baseSepolia,
  CHAIN_CONFIG.polygonAmoy,
  // Networks without contracts
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
    CHAIN_CONFIG.polygonAmoy.id,
    CHAIN_CONFIG.sepolia.id,
    CHAIN_CONFIG.arbitrumSepolia.id,
    CHAIN_CONFIG.optimismSepolia.id,
    CHAIN_CONFIG.anvil.id,
  ];
  const isTestnet = testnetIds.includes(selectedNetwork.id);

  // Load saved network from localStorage on mount, default to Base Sepolia
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedNetworkId = localStorage.getItem('selectedNetworkId');
    if (savedNetworkId) {
      const network = AVAILABLE_NETWORKS.find(n => n.id === parseInt(savedNetworkId));
      // Restore if network exists and has contracts deployed
      if (network && hasContracts(network.id)) {
        setActiveChainId(network.id);
        setSelectedNetworkState(network);
      } else {
        // Fall back to Base Sepolia
        setActiveChainId(CHAIN_CONFIG.baseSepolia.id);
        setSelectedNetworkState(CHAIN_CONFIG.baseSepolia);
        localStorage.setItem('selectedNetworkId', CHAIN_CONFIG.baseSepolia.id.toString());
      }
    } else {
      // No saved network, default to Base Sepolia
      setActiveChainId(CHAIN_CONFIG.baseSepolia.id);
      localStorage.setItem('selectedNetworkId', CHAIN_CONFIG.baseSepolia.id.toString());
    }
  }, []);

  // Save to localStorage when network changes
  const setSelectedNetwork = useCallback((network: AvailableNetwork) => {
    // Only allow setting networks that have contracts deployed
    if (!hasContracts(network.id)) {
      console.warn(`Network ${network.name} does not have contracts deployed. Cannot switch to this network.`);
      return;
    }
    // Update global contract addresses & token list BEFORE React re-render
    setActiveChainId(network.id);
    // Clear stale data from the previous network
    useContractStore.getState().clearAll();
    setSelectedNetworkState(network);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedNetworkId', network.id.toString());
    }
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
