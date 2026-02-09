'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Banknote, Loader2, TrendingUp, Shield } from 'lucide-react';
import { Address } from 'viem';
import { SUPPORTED_FIAT_CURRENCIES, getCurrencySymbol, useExchangeRate, convertFromUSDCents } from '@/hooks/useFiatOracle';
import { useCryptoAssets } from '@/hooks/useSupplyAssets';

export type BorrowType = 'crypto' | 'cash' | null;

export interface BorrowAsset {
  symbol: string;
  name: string;
  address?: Address;
  decimals?: number;
  type?: 'crypto' | 'fiat';
  balance?: string;
  hasBalance?: boolean;
  icon?: string;
}

interface BorrowAssetSelectorProps {
  borrowType: BorrowType;
  selectedAsset: BorrowAsset | null;
  onBorrowTypeChange: (type: BorrowType) => void;
  onAssetSelect: (asset: BorrowAsset) => void;
  excludeSymbol?: string;
  // LTV props (for crypto)
  selectedLTV: number;
  maxLTV: number;
  minLTV?: number;
  onLTVChange: (ltv: number) => void;
  liquidationThreshold?: number;
  // Calculated borrow amount (for crypto)
  borrowAmount: number;
  borrowAmountUSD?: number;
  // Loading states
  isCalculatingLoan?: boolean;
  // Fiat-specific props
  collateralValueUSD?: number;
}

export function BorrowAssetSelector({
  borrowType,
  selectedAsset,
  onBorrowTypeChange,
  onAssetSelect,
  excludeSymbol,
  selectedLTV,
  maxLTV,
  minLTV = 10,
  onLTVChange,
  liquidationThreshold = 85,
  borrowAmount,
  borrowAmountUSD,
  isCalculatingLoan = false,
  collateralValueUSD = 0,
}: BorrowAssetSelectorProps) {
  // Fetch crypto assets from contract (same as lender)
  const { assets: cryptoAssetsFromHook, isLoading: isLoadingCrypto } = useCryptoAssets();

  // Build crypto assets from hook data, excluding collateral token
  const cryptoAssets: BorrowAsset[] = useMemo(() => {
    return cryptoAssetsFromHook
      .filter(a => a.symbol !== excludeSymbol)
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        address: asset.address,
        decimals: asset.decimals,
        type: 'crypto' as const,
        balance: asset.balance,
        hasBalance: asset.hasBalance,
      }));
  }, [cryptoAssetsFromHook, excludeSymbol]);

  // Build fiat assets from supported currencies (same as lender)
  const fiatAssets: BorrowAsset[] = SUPPORTED_FIAT_CURRENCIES.map((currency) => ({
    symbol: currency.code,
    name: currency.name,
    type: 'fiat' as const,
  }));

  const assets = borrowType === 'crypto' ? cryptoAssets : borrowType === 'cash' ? fiatAssets : [];

  // Get exchange rate for selected fiat currency
  const { data: exchangeRate, isLoading: isLoadingExchangeRate } = useExchangeRate(
    selectedAsset?.type === 'fiat' ? selectedAsset.symbol : ''
  );

  // Calculate fiat borrow amount based on collateral value, selected LTV, and exchange rate
  const calculatedFiatAmount = useMemo(() => {
    if (!selectedAsset || selectedAsset.type !== 'fiat' || !collateralValueUSD || collateralValueUSD <= 0 || selectedLTV <= 0) {
      return { amount: 0, amountCents: BigInt(0) };
    }

    // Convert collateral USD value to cents
    const collateralUSDCents = BigInt(Math.floor(collateralValueUSD * 100));

    // Use selected LTV from slider
    const fiatLTV = BigInt(Math.floor(selectedLTV));
    const borrowUSDCents = (collateralUSDCents * fiatLTV) / BigInt(100);

    // Convert USD to target currency using exchange rate
    if (selectedAsset.symbol === 'USD') {
      return {
        amount: Number(borrowUSDCents) / 100,
        amountCents: borrowUSDCents,
      };
    }

    if (!exchangeRate || exchangeRate === BigInt(0)) {
      return { amount: 0, amountCents: BigInt(0) };
    }

    const fiatAmountCents = convertFromUSDCents(borrowUSDCents, exchangeRate as bigint);
    return {
      amount: Number(fiatAmountCents) / 100,
      amountCents: fiatAmountCents,
    };
  }, [selectedAsset, collateralValueUSD, exchangeRate, selectedLTV]);

  // Calculate slider percentage for gradient
  const ltvPercentage = maxLTV > minLTV
    ? ((selectedLTV - minLTV) / (maxLTV - minLTV)) * 100
    : 50;

  // Format number with decimals
  const formatAmount = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  // Format fiat amount with currency symbol
  const formatFiatAmount = (amount: number, currency: string) => {
    return `${getCurrencySymbol(currency)}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        What do you want to borrow?
      </h2>
      <p className="text-sm text-white/50 mb-6 text-center">
        Choose between crypto tokens or cash
      </p>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Crypto Option */}
        <motion.button
          onClick={() => onBorrowTypeChange('crypto')}
          className={`
            relative p-6 rounded-2xl border-2 transition-all duration-300
            ${borrowType === 'crypto'
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }
          `}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={`
            w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center
            ${borrowType === 'crypto' ? 'bg-orange-500/20' : 'bg-white/10'}
          `}>
            <Coins className={`w-6 h-6 ${borrowType === 'crypto' ? 'text-orange-400' : 'text-white/60'}`} />
          </div>
          <h3 className={`font-semibold text-center ${borrowType === 'crypto' ? 'text-orange-400' : 'text-white'}`}>
            Crypto
          </h3>
          <p className="text-xs text-white/40 text-center mt-1">
            Borrow stablecoins
          </p>
          {borrowType === 'crypto' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"
            >
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}
        </motion.button>

        {/* Cash Option */}
        <motion.button
          onClick={() => onBorrowTypeChange('cash')}
          className={`
            relative p-6 rounded-2xl border-2 transition-all duration-300
            ${borrowType === 'cash'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }
          `}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className={`
            w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center
            ${borrowType === 'cash' ? 'bg-primary-500/20' : 'bg-white/10'}
          `}>
            <Banknote className={`w-6 h-6 ${borrowType === 'cash' ? 'text-primary-400' : 'text-white/60'}`} />
          </div>
          <h3 className={`font-semibold text-center ${borrowType === 'cash' ? 'text-primary-400' : 'text-white'}`}>
            Cash
          </h3>
          <p className="text-xs text-white/40 text-center mt-1">
            Borrow local currency
          </p>
          {borrowType === 'cash' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
            >
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Asset Cards */}
      <AnimatePresence mode="wait">
        {borrowType && (
          <motion.div
            key={borrowType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {isLoadingCrypto && borrowType === 'crypto' ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/50">
                  {borrowType === 'crypto' ? 'No borrow assets available.' : 'No supported currencies found.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assets.map((asset, index) => {
                  const isSelected = selectedAsset?.symbol === asset.symbol;
                  const accentColor = borrowType === 'crypto' ? 'orange' : 'blue';
                  const isCrypto = asset.type === 'crypto';
                  const isDisabled = isCrypto && !asset.hasBalance;

                  return (
                    <motion.button
                      key={asset.symbol}
                      onClick={() => !isDisabled && onAssetSelect(asset)}
                      disabled={isDisabled}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`
                        relative p-4 rounded-xl text-center transition-all duration-300
                        border-2 group
                        ${isDisabled
                          ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]'
                          : isSelected
                            ? `border-${accentColor}-500 bg-${accentColor}-500/10`
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }
                      `}
                      style={{
                        borderColor: isDisabled ? undefined : isSelected ? (accentColor === 'orange' ? '#f97316' : '#3b82f6') : undefined,
                        backgroundColor: isDisabled ? undefined : isSelected ? (accentColor === 'orange' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(59, 130, 246, 0.1)') : undefined,
                      }}
                      whileHover={isDisabled ? {} : { y: -2 }}
                      whileTap={isDisabled ? {} : { scale: 0.95 }}
                    >
                      <div
                        className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: isDisabled
                            ? 'rgba(255,255,255,0.05)'
                            : isSelected
                              ? (accentColor === 'orange' ? '#f97316' : '#3b82f6')
                              : 'rgba(255,255,255,0.1)',
                          color: isDisabled ? 'rgba(255,255,255,0.3)' : isSelected ? 'white' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {asset.symbol.slice(0, 2)}
                      </div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: isDisabled ? 'rgba(255,255,255,0.3)' : isSelected ? (accentColor === 'orange' ? '#fb923c' : '#60a5fa') : 'white' }}
                      >
                        {asset.symbol}
                      </p>

                      {/* Show balance for crypto assets */}
                      {isCrypto && asset.balance && (
                        <p className={`text-xs mt-1 truncate ${isDisabled ? 'text-white/20' : 'text-white/40'}`}>
                          {asset.balance}
                        </p>
                      )}

                      {/* Show name for fiat assets */}
                      {!isCrypto && (
                        <p className="text-xs text-white/40 mt-1">{asset.name}</p>
                      )}

                      {isSelected && !isDisabled && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: accentColor === 'orange' ? '#f97316' : '#3b82f6' }}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Borrow Amount & LTV Slider - shows after selecting an asset */}
      <AnimatePresence>
        {selectedAsset && borrowType === 'crypto' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-primary-500/10 border border-white/10"
          >
            {/* Borrow Amount Display (Auto-calculated, disabled) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Borrow Amount (Auto-calculated)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={isCalculatingLoan ? 'Calculating...' : formatAmount(borrowAmount)}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center gap-2 min-w-[60px]">
                  {isCalculatingLoan && (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                  )}
                  <span className="text-sm text-white/60">{selectedAsset.symbol}</span>
                </div>
              </div>
              {borrowAmountUSD !== undefined && borrowAmountUSD > 0 && (
                <p className="text-sm text-white/50 mt-1">
                  ≈ ${borrowAmountUSD.toFixed(2)} USD
                </p>
              )}
            </div>

            {/* LTV Slider */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">
                Loan-to-Value (LTV) Ratio
              </label>
              <input
                type="range"
                min={minLTV}
                max={maxLTV}
                step="1"
                value={selectedLTV}
                onChange={(e) => onLTVChange(Number(e.target.value))}
                disabled={!maxLTV || maxLTV === 0 || isCalculatingLoan}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-50
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-orange-500
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:shadow-orange-500/30
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-orange-500
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:cursor-pointer
                "
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${ltvPercentage}%, rgba(255,255,255,0.1) ${ltvPercentage}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">{minLTV}%</span>
                <span className="text-lg font-semibold text-orange-400">{selectedLTV.toFixed(0)}%</span>
                <span className="text-white/50">{maxLTV.toFixed(0)}% max</span>
              </div>
              <p className="text-xs text-white/40">
                Lower LTV = safer position, less borrowing power. Higher LTV = more borrowing, higher liquidation risk.
              </p>
            </div>

            {/* LTV Info Box */}
            <div className="mt-4 p-3 rounded-xl bg-white/5 space-y-1">
              <p className="text-xs text-white/60 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Selected LTV: <span className="text-orange-400 font-medium">{selectedLTV.toFixed(0)}%</span>
                <span className="text-white/40">(Max: {maxLTV.toFixed(2)}%)</span>
              </p>
              <p className="text-xs text-white/60 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Liquidation Threshold: <span className="text-yellow-400 font-medium">{liquidationThreshold.toFixed(2)}%</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fiat Borrow Amount Panel - shows after selecting a fiat currency */}
      <AnimatePresence>
        {selectedAsset && borrowType === 'cash' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-primary-500/10 to-green-500/10 border border-white/10"
          >
            {/* Collateral Value */}
            <div className="mb-4 p-3 rounded-xl bg-white/5">
              <p className="text-xs text-white/50 mb-1">Your Collateral Value</p>
              <p className="text-lg font-semibold text-white">
                ${collateralValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            </div>

            {/* LTV Slider for Fiat */}
            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium text-white/70">
                Loan-to-Value (LTV) Ratio
              </label>
              <input
                type="range"
                min={minLTV}
                max={maxLTV}
                step="1"
                value={selectedLTV}
                onChange={(e) => onLTVChange(Number(e.target.value))}
                disabled={!maxLTV || maxLTV === 0}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-50
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:shadow-primary-500/30
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-blue-500
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:cursor-pointer
                "
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${ltvPercentage}%, rgba(255,255,255,0.1) ${ltvPercentage}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">{minLTV}%</span>
                <span className="text-lg font-semibold text-primary-400">{selectedLTV.toFixed(0)}%</span>
                <span className="text-white/50">{maxLTV.toFixed(0)}% max</span>
              </div>
            </div>

            {/* Fiat Borrow Amount Display */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Borrow Amount (Auto-calculated)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="w-full px-4 py-3 rounded-xl bg-white/5 border border-primary-500/30 text-white font-medium">
                    {isLoadingExchangeRate ? (
                      <span className="text-white/50">Calculating...</span>
                    ) : calculatedFiatAmount.amount > 0 ? (
                      <span className="text-primary-400 text-lg">
                        {formatFiatAmount(calculatedFiatAmount.amount, selectedAsset.symbol)}
                      </span>
                    ) : (
                      <span className="text-white/50">-</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-[60px]">
                  {isLoadingExchangeRate && (
                    <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                  )}
                  <span className="text-sm text-white/60">{selectedAsset.symbol}</span>
                </div>
              </div>
              {selectedAsset.symbol !== 'USD' && typeof exchangeRate === 'bigint' && exchangeRate > BigInt(0) ? (
                <p className="text-xs text-white/40 mt-2">
                  Exchange Rate: 1 USD = {(Number(exchangeRate) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedAsset.symbol}
                </p>
              ) : null}
            </div>

            {/* Fiat LTV Info Box */}
            <div className="p-3 rounded-xl bg-white/5 space-y-2">
              <p className="text-xs text-white/60 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Selected LTV: <span className="text-primary-400 font-medium">{selectedLTV.toFixed(0)}%</span>
                <span className="text-white/40">(Max: {maxLTV.toFixed(0)}%)</span>
              </p>
              <p className="text-xs text-white/60 flex items-center gap-1">
                <Banknote className="w-3 h-3" />
                Receive funds via: <span className="text-green-400 font-medium">Bank Transfer / Mobile Money</span>
              </p>
              <p className="text-xs text-white/40 mt-2">
                A verified fiat supplier will fund your loan. You will repay in {selectedAsset.symbol} to get your crypto back.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
