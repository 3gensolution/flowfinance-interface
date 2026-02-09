'use client';

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { CollateralAsset } from './CollateralSelector';
import { BorrowAsset } from './BorrowAssetSelector';

// Currency symbol helper
const getCurrencySymbol = (symbol: string) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  return symbols[symbol] || '$';
};

interface QuotationPanelProps {
  collateral: CollateralAsset | null;
  collateralAmount: string;
  borrowAsset: BorrowAsset | null;
  loanAmount: number;
  interestRate: number;
  duration: number;
  collateralValueUSD?: number;
  ltvPercent?: number;
  selectedLTV?: number;
  borrowType?: 'crypto' | 'cash' | null;
  fiatAmountFormatted?: string;
  fiatAmount?: number; // Raw fiat amount for calculations
}

export function QuotationPanel({
  collateral,
  collateralAmount,
  borrowAsset,
  loanAmount,
  interestRate,
  duration,
  collateralValueUSD = 0,
  ltvPercent = 0,
  selectedLTV = 0,
  borrowType = 'crypto',
  fiatAmountFormatted,
  fiatAmount = 0,
}: QuotationPanelProps) {
  // For crypto, check loanAmount; for fiat, check fiatAmountFormatted
  const isCrypto = borrowType === 'crypto';
  const hasValidAmount = isCrypto ? loanAmount > 0 : !!fiatAmountFormatted;

  if (!collateral || !borrowAsset || !collateralAmount || !hasValidAmount) {
    return null;
  }

  // Calculate interest and total repayment for crypto
  const cryptoInterestAmount = (loanAmount * interestRate) / 100;
  const cryptoTotalRepayment = loanAmount + cryptoInterestAmount;

  // Calculate interest and total repayment for fiat
  const fiatInterestAmount = (fiatAmount * interestRate) / 100;
  const fiatTotalRepayment = fiatAmount + fiatInterestAmount;

  // Use selected LTV if provided, otherwise calculate from loan amount
  const actualLTV = selectedLTV > 0 ? selectedLTV : (collateralValueUSD > 0 ? (loanAmount / collateralValueUSD) * 100 : 0);

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Format fiat amount with currency symbol
  const formatFiat = (amount: number) => {
    const symbol = getCurrencySymbol(borrowAsset?.symbol || 'USD');
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Animated number component
  const AnimatedValue = ({ value, prefix = '' }: { value: string; prefix?: string }) => (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="font-bold text-white"
    >
      {prefix}{value}
    </motion.span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        Loan Summary
      </h2>
      <p className="text-sm text-white/50 mb-6 text-center">
        Review your loan details before submitting
      </p>

      <div className="p-6 rounded-2xl bg-gradient-to-br from-primary-500/10 to-purple-500/10 border border-white/10">
        {/* Summary Items */}
        <div className="space-y-4">
          {/* Collateral */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Collateral</span>
            <div className="text-right">
              <AnimatedValue value={`${collateralAmount} ${collateral.symbol}`} />
              {collateralValueUSD > 0 && (
                <p className="text-xs text-white/40">≈ ${formatNumber(collateralValueUSD)}</p>
              )}
            </div>
          </div>

          {/* You Receive */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">You receive</span>
            <span className="text-green-400">
              {isCrypto ? (
                <AnimatedValue value={`${formatNumber(loanAmount)} ${borrowAsset.symbol}`} />
              ) : (
                <AnimatedValue value={fiatAmountFormatted || '-'} />
              )}
            </span>
          </div>

          {/* LTV */}
          {ltvPercent > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-white/60">Loan-to-Value</span>
              <div className="text-right">
                <AnimatedValue value={`${actualLTV.toFixed(1)}%`} />
                <p className="text-xs text-white/40">Max allowed: {ltvPercent.toFixed(0)}%</p>
              </div>
            </div>
          )}

          {/* Interest */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Interest rate</span>
            <AnimatedValue value={`${interestRate}%`} />
          </div>

          {/* Duration */}
          <div className="flex justify-between items-center">
            <span className="text-white/60">Duration</span>
            <AnimatedValue value={`${duration} days`} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-4" />

        {/* Total Repayment */}
        {isCrypto ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Total repayment</span>
              <span className="text-xl text-white">
                <AnimatedValue value={`${formatNumber(cryptoTotalRepayment)} ${borrowAsset.symbol}`} />
              </span>
            </div>

            {/* Interest breakdown */}
            <p className="text-xs text-white/40 text-right mt-1">
              Includes {formatNumber(cryptoInterestAmount)} {borrowAsset.symbol} interest
            </p>
          </>
        ) : (
          <>
            {/* Interest Amount */}
            <div className="flex justify-between items-center">
              <span className="text-white/60">Interest ({interestRate}%)</span>
              <AnimatedValue value={formatFiat(fiatInterestAmount)} />
            </div>

            {/* Total Repayment */}
            <div className="flex justify-between items-center mt-3">
              <span className="text-white font-medium">Total repayment</span>
              <span className="text-xl text-white">
                <AnimatedValue value={formatFiat(fiatTotalRepayment)} />
              </span>
            </div>

            {/* Breakdown note */}
            <p className="text-xs text-white/40 text-right mt-1">
              Principal {fiatAmountFormatted} + {formatFiat(fiatInterestAmount)} interest
            </p>
          </>
        )}

        {/* Info Notes */}
        <div className="mt-6 space-y-2">
          <div className="flex items-start gap-2 text-xs text-white/50">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Your collateral is returned after full repayment</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
