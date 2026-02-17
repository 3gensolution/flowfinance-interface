'use client';

import { motion } from 'framer-motion';

export type AssetType = 'crypto' | 'fiat';

export interface Asset {
  symbol: string;
  name: string;
  address?: string;
  decimals?: number;
  balance: string;
  rawBalance?: bigint;
  icon?: string;
}

interface AmountInputProps {
  assetType: AssetType;
  asset: Asset | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  minAmount?: string;
  title?: string;
  showUsdValue?: boolean;
  usdValue?: number;
}

export function AmountInput({
  assetType,
  asset,
  amount,
  onAmountChange,
  minAmount = '0.001',
  title,
  showUsdValue = false,
  usdValue,
}: AmountInputProps) {
  if (!asset) return null;

  const isCrypto = assetType === 'crypto';

  // Use balance from the asset
  const availableBalance = asset.balance || '0';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      onAmountChange(value);
    }
  };

  const handleMaxClick = () => {
    // Remove currency symbols and commas for crypto, parse fiat differently
    const cleanBalance = availableBalance
      .replace(/[₦$€£R₵]/g, '')
      .replace(/,/g, '')
      .trim();
    onAmountChange(cleanBalance);
  };

  // Format USD value
  const formatUsdValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <motion.div
      key={asset.symbol}
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
      className="w-full max-w-xl mx-auto"
    >
      {/* Section Label */}
      {title && (
        <h2 className="text-xl font-semibold text-white mb-6 text-center">
          {title}
        </h2>
      )}

      {/* Amount Input Card */}
      <div
        className={`
          p-4 sm:p-6 rounded-2xl border-2 bg-white/5
          ${isCrypto ? 'border-primary-500/30' : 'border-primary-500/30'}
        `}
      >
        {/* Input Row */}
        <div className="flex items-center gap-2 sm:gap-4">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={handleInputChange}
            placeholder="0.00"
            autoFocus
            className="
              flex-1 min-w-0 text-3xl sm:text-4xl md:text-5xl font-bold text-white
              bg-transparent border-none outline-none focus:outline-none focus:ring-0
              placeholder:text-white/20 caret-primary-400
            "
          />

          {/* Currency Badge */}
          <div
            className={`
              flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl flex-shrink-0
              ${isCrypto ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-500/20 text-primary-400'}
            `}
          >
            <div
              className={`
                w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold
                ${isCrypto ? 'bg-blue-500 text-white' : 'bg-blue-500 text-white'}
              `}
            >
              {asset.symbol.slice(0, 2)}
            </div>
            <span className="font-semibold text-sm sm:text-base">{asset.symbol}</span>
          </div>
        </div>

        {/* USD Value Display */}
        {showUsdValue && usdValue !== undefined && usdValue > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-white/40 mt-2 text-sm sm:text-base"
          >
            ≈ {formatUsdValue(usdValue)} USD
          </motion.p>
        )}

        {/* Balance Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm text-white/40">Available:</span>
            <span className="text-xs sm:text-sm font-medium text-white/70 truncate max-w-[120px] sm:max-w-none">
              {isCrypto ? `${availableBalance} ${asset.symbol}` : availableBalance}
            </span>
            <button
              onClick={handleMaxClick}
              className={`
                text-xs font-semibold px-2 py-0.5 rounded
                transition-colors duration-200
                text-primary-400 hover:bg-primary-500/20
              `}
            >
              MAX
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm text-white/40">Minimum:</span>
            <span className="text-xs sm:text-sm font-medium text-white/70">
              {minAmount} {asset.symbol}
            </span>
          </div>
        </div>
      </div>

      {amount && parseFloat(amount) > 0 && parseFloat(amount) < parseFloat(minAmount) && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-400 mt-3 text-center"
        >
          Amount must be at least {minAmount} {asset.symbol}
        </motion.p>
      )}
    </motion.div>
  );
}
