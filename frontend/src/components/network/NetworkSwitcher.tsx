'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Network, Check, Lock } from 'lucide-react';
import { useNetwork, AVAILABLE_NETWORKS, type AvailableNetwork, hasContracts } from '@/contexts/NetworkContext';
import { TESTNET_CHAINS, MAINNET_CHAINS } from '@/config/contracts';
import { cn } from '@/lib/utils';

type NetworkTab = 'testnet' | 'mainnet';

export function NetworkSwitcher() {
  const { selectedNetwork, setSelectedNetwork, isTestnet } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NetworkTab>('testnet');

  // Get testnet and mainnet IDs from configs
  const testnetIds: number[] = TESTNET_CHAINS.map(chain => chain.id);
  const mainnetIds: number[] = MAINNET_CHAINS.map(chain => chain.id);

  // Group networks by type
  const testnets = AVAILABLE_NETWORKS.filter(network =>
    testnetIds.includes(network.id)
  );

  const mainnets = AVAILABLE_NETWORKS.filter(network =>
    mainnetIds.includes(network.id)
  );

  // Sort networks: available first, then unavailable
  const sortedTestnets = useMemo(() => {
    return [...testnets].sort((a, b) => {
      const aAvailable = hasContracts(a.id);
      const bAvailable = hasContracts(b.id);
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });
  }, [testnets]);

  const sortedMainnets = useMemo(() => {
    return [...mainnets].sort((a, b) => {
      const aAvailable = hasContracts(a.id);
      const bAvailable = hasContracts(b.id);
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      return 0;
    });
  }, [mainnets]);

  const displayedNetworks = activeTab === 'testnet' ? sortedTestnets : sortedMainnets;

  const handleNetworkSelect = (network: AvailableNetwork) => {
    // Only allow selection if network has contracts deployed
    if (!hasContracts(network.id)) {
      return; // Don't allow selection of disabled networks
    }
    setSelectedNetwork(network);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Reset to testnet tab when opening
    if (open) {
      setActiveTab('testnet');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => handleOpenChange(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Network className="w-4 h-4 text-primary-400" />
        <span className="text-sm font-medium hidden sm:inline">{selectedNetwork.name}</span>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs",
          isTestnet ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
        )}>
          {isTestnet ? 'Testnet' : 'Mainnet'}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => handleOpenChange(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-navy-900 border border-white/10 shadow-xl z-50 overflow-hidden"
            >
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('testnet')}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-xs font-medium transition-all relative',
                    activeTab === 'testnet'
                      ? 'text-yellow-400 bg-yellow-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  Testnets
                  {activeTab === 'testnet' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('mainnet')}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-xs font-medium transition-all relative',
                    activeTab === 'mainnet'
                      ? 'text-green-400 bg-green-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  Mainnets
                  {activeTab === 'mainnet' && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              {/* Networks List */}
              <div className="p-2 max-h-[300px] overflow-y-auto">
                {displayedNetworks.map((network) => {
                  const isAvailable = hasContracts(network.id);
                  return (
                    <button
                      key={network.id}
                      onClick={() => handleNetworkSelect(network)}
                      disabled={!isAvailable}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                        !isAvailable && 'opacity-50 cursor-not-allowed',
                        selectedNetwork.id === network.id
                          ? 'bg-primary-500/20 text-primary-400'
                          : isAvailable
                          ? 'hover:bg-white/5 text-gray-300'
                          : 'text-gray-500'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isAvailable ? (
                          <Network className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span className="truncate">
                          {network.name}
                          {!isAvailable && (
                            <span className="text-xs text-gray-500 ml-1">(Soon)</span>
                          )}
                        </span>
                      </span>
                      {selectedNetwork.id === network.id && (
                        <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
