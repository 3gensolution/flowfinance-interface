'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Banknote, AlertCircle, X, ArrowRightLeft } from 'lucide-react';
import { useIsVerifiedSupplier } from '@/hooks/useSupplyAssets';
import { isFiatSupportedOnActiveChain, CHAIN_CONFIG } from '@/config/contracts';
import { useNetwork } from '@/contexts/NetworkContext';
import { useSwitchChain } from 'wagmi';

export type AssetType = 'crypto' | 'cash' | null;

interface AssetTypeSelectorProps {
  selected: AssetType;
  onSelect: (type: AssetType) => void;
}

const assetTypes = [
  {
    type: 'crypto' as const,
    icon: Coins,
    title: 'Crypto',
    description: 'Lend digital assets like USDT, ETH, or BTC and earn interest when borrowers use your funds.',
    accentColor: 'orange',
    requiresVerification: false,
  },
  {
    type: 'cash' as const,
    icon: Banknote,
    title: 'Cash',
    description: 'Lend fiat currencies like NGN or USD backed by crypto collateral for added security.',
    accentColor: 'blue',
    requiresVerification: true,
  },
];

export function AssetTypeSelector({ selected, onSelect }: AssetTypeSelectorProps) {
  const { isVerified, isLoading: isVerificationLoading } = useIsVerifiedSupplier();
  const { setSelectedNetwork } = useNetwork();
  const { switchChain } = useSwitchChain();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showChainTooltip, setShowChainTooltip] = useState(false);
  const fiatSupported = isFiatSupportedOnActiveChain();

  const handleSwitchToBase = () => {
    setSelectedNetwork(CHAIN_CONFIG.baseSepolia);
    switchChain({ chainId: CHAIN_CONFIG.baseSepolia.id });
    setShowChainTooltip(false);
  };

  const handleSelect = (type: AssetType, requiresVerification: boolean) => {
    // If cash is selected on a non-Base chain, show chain switch prompt
    if (type === 'cash' && !fiatSupported) {
      setShowChainTooltip(true);
      setShowTooltip(false);
      return;
    }
    // If cash is selected and user is not verified, show tooltip
    if (requiresVerification && !isVerified) {
      setShowTooltip(true);
      setShowChainTooltip(false);
      return;
    }
    setShowTooltip(false);
    setShowChainTooltip(false);
    onSelect(type);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
      className="w-full"
    >
      {/* Section Label */}
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        What would you like to lend?
      </h2>

      {/* Asset Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {assetTypes.map((asset) => {
          const isSelected = selected === asset.type;
          const Icon = asset.icon;
          const isOrange = asset.accentColor === 'orange';
          const isCashOnWrongChain = asset.type === 'cash' && !fiatSupported;
          const isDisabled = isCashOnWrongChain || (asset.requiresVerification && !isVerified && !isVerificationLoading);

          return (
            <motion.button
              key={asset.type}
              onClick={() => handleSelect(asset.type, asset.requiresVerification)}
              disabled={asset.requiresVerification && isVerificationLoading}
              className={`
                relative p-6 rounded-2xl text-left transition-all duration-300
                border-2 cursor-pointer group
                ${isDisabled ? 'opacity-70' : ''}
                ${isSelected
                  ? isOrange
                    ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20'
                    : 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }
              `}
              whileHover={{ y: isDisabled ? 0 : -4 }}
              whileTap={{ scale: isDisabled ? 1 : 0.98 }}
            >
              {/* Icon */}
              <div
                className={`
                  w-14 h-14 rounded-xl flex items-center justify-center mb-4
                  transition-colors duration-300
                  ${isSelected
                    ? isOrange
                      ? 'bg-orange-500 text-white'
                      : 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 group-hover:bg-white/20'
                  }
                `}
              >
                <Icon className="w-7 h-7" />
              </div>

              {/* Title */}
              <h3
                className={`
                  text-xl font-bold mb-2 transition-colors duration-300
                  ${isSelected
                    ? isOrange
                      ? 'text-orange-400'
                      : 'text-primary-400'
                    : 'text-white'
                  }
                `}
              >
                {asset.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/50 leading-relaxed">
                {asset.description}
              </p>

              {/* Base-only Badge for Cash on wrong chain */}
              {isCashOnWrongChain && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-400">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Available on Base only</span>
                </div>
              )}

              {/* Verification Badge for Cash */}
              {!isCashOnWrongChain && asset.requiresVerification && !isVerified && !isVerificationLoading && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Requires verification</span>
                </div>
              )}

              {/* Selected Indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`
                    absolute top-4 right-4 w-6 h-6 rounded-full
                    flex items-center justify-center
                    ${isOrange ? 'bg-orange-500' : 'bg-blue-500'}
                  `}
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Supplier Verification Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 max-w-2xl mx-auto"
          >
            <div className="relative p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              {/* Close Button */}
              <button
                onClick={() => setShowTooltip(false)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-yellow-400" />
              </button>

              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-400 mb-1">
                    Supplier Verification Required
                  </h4>
                  <p className="text-sm text-white/70 mb-3">
                    To supply cash liquidity, you need to register as a verified cash provider first.
                    This ensures trust and security for all users on the platform.
                  </p>
                  <a
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold text-sm hover:bg-yellow-400 transition-colors"
                  >
                    Register as Cash Provider
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch to Base Chain Tooltip */}
      <AnimatePresence>
        {showChainTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 max-w-2xl mx-auto"
          >
            <div className="relative p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <button
                onClick={() => setShowChainTooltip(false)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-blue-400" />
              </button>

              <div className="flex gap-3">
                <ArrowRightLeft className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-400 mb-1">
                    Switch to Base Network
                  </h4>
                  <p className="text-sm text-white/70 mb-3">
                    Cash lending is only available on the Base network. Switch to Base Sepolia to access fiat lending features.
                  </p>
                  <button
                    onClick={handleSwitchToBase}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-400 transition-colors"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Switch to Base Sepolia
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
