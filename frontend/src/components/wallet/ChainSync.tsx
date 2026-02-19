'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useNetwork, AVAILABLE_NETWORKS, hasContracts } from '@/contexts/NetworkContext';
import { setActiveChainId } from '@/config/contracts';

/**
 * Syncs wallet chain changes (e.g. from RainbowKit chain modal) with NetworkContext.
 * When the user switches chains via the wallet UI, this detects the change and
 * updates CONTRACT_ADDRESSES + NetworkContext so the entire app reflects the new chain.
 */
export function ChainSync() {
  const { chain } = useAccount();
  const { selectedNetwork, setSelectedNetwork } = useNetwork();
  const lastSyncedChainId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!chain?.id) return;
    // Skip if already in sync
    if (chain.id === selectedNetwork.id) {
      lastSyncedChainId.current = chain.id;
      return;
    }
    // Skip if we already synced this chain (prevents loops)
    if (chain.id === lastSyncedChainId.current) return;

    // Find the network in our available networks
    const network = AVAILABLE_NETWORKS.find(n => n.id === chain.id);
    if (network && hasContracts(network.id)) {
      lastSyncedChainId.current = chain.id;
      setSelectedNetwork(network);
    }
  }, [chain?.id, selectedNetwork.id, setSelectedNetwork]);

  return null;
}
