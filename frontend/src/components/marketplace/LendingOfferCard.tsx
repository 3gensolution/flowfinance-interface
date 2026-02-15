'use client';

import { motion } from 'framer-motion';
import { Clock, Coins, TrendingUp, ArrowRight, Wallet, Network } from 'lucide-react';
import { LenderOffer, LoanRequestStatus } from '@/types';
import { FiatLenderOffer, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import { formatTokenAmount, formatPercentage, formatDuration, formatRelativeTime, getTokenSymbol, getTokenDecimals, convertFiatToUSD } from '@/lib/utils';
import { useTokenPrice } from '@/hooks/useContracts';
import { formatCurrency } from '@/hooks/useFiatOracle';
import { getChainById } from '@/config/contracts';
import Link from 'next/link';

// Helper to format USD values
function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

interface CryptoLendingOfferCardProps {
  offer: LenderOffer;
  index?: number;
}

export function CryptoLendingOfferCard({ offer, index = 0 }: CryptoLendingOfferCardProps) {
  const lendSymbol = getTokenSymbol(offer.lendAsset);
  const lendDecimals = getTokenDecimals(offer.lendAsset);
  const chainInfo = 'chainId' in offer && offer.chainId ? getChainById(Number(offer.chainId)) : null;

  // Check if collateral is "any" (zero address means borrower chooses)
  const isAnyCollateral = offer.requiredCollateralAsset === '0x0000000000000000000000000000000000000000';
  const collateralSymbol = isAnyCollateral ? 'Any' : getTokenSymbol(offer.requiredCollateralAsset);

  // Get USD prices
  const { price: lendPrice } = useTokenPrice(offer.lendAsset);

  // Calculate USD values
  const lendAmount = Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals));
  const lendUSD = lendPrice ? lendAmount * Number(lendPrice) / 1e8 : 0;

  // Calculate remaining (available) amount
  const remainingAmount = Number(offer.remainingAmount) / Math.pow(10, Number(lendDecimals));
  const remainingUSD = lendPrice ? remainingAmount * Number(lendPrice) / 1e8 : 0;

  // Calculate borrowed amount
  const borrowedAmount = Number(offer.borrowedAmount) / Math.pow(10, Number(lendDecimals));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group"
    >
      <Link href={`/offer/${offer.offerId}`}>
        <div className="h-full glass-card p-6 rounded-2xl border border-white/10 hover:border-accent-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent-500/10">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Available to lend</span>
              <div className="flex items-center gap-2">
                {chainInfo && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                    <Network className="w-3 h-3" />
                    {chainInfo.name}
                  </span>
                )}
                {offer.status === LoanRequestStatus.PENDING && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-accent-500/20 text-accent-400">Active</span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {formatTokenAmount(offer.lendAmount, lendDecimals)}
              </span>
              <span className="text-lg text-accent-400">{lendSymbol}</span>
            </div>
            {lendUSD > 0 && (
              <p className="text-sm text-gray-400 mt-1">{formatUSD(lendUSD)}</p>
            )}
          </div>

          {/* Asset Info Section */}
          <div className="mb-4 p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-accent-400" />
              <span className="text-xs text-gray-400">Asset</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-accent-400">{lendSymbol}</span>
            </div>
          </div>

          {/* Available to Borrow */}
          <div className="mb-4 p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary-400" />
              <span className="text-xs text-gray-400">Available to Borrow</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white">
                {formatTokenAmount(offer.remainingAmount, lendDecimals)}
              </span>
              <span className="text-accent-400">{lendSymbol}</span>
            </div>
            {remainingUSD > 0 && (
              <p className="text-xs text-gray-500">{formatUSD(remainingUSD)}</p>
            )}
            {borrowedAmount > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formatTokenAmount(offer.borrowedAmount, lendDecimals)} already borrowed
              </p>
            )}
          </div>

          {/* Collateral Type Badge */}
          <div className="mb-4 p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Accepted Collateral</span>
              <span className="text-sm font-medium text-accent-400">
                {isAnyCollateral ? 'Flexible - Borrower chooses' : collateralSymbol}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-gray-400">Interest</span>
              </div>
              <span className="text-lg font-bold text-orange-400">
                {formatPercentage(offer.interestRate)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-xs text-gray-400">Duration</span>
              </div>
              <span className="text-lg font-semibold text-white">
                {formatDuration(offer.duration)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Posted {formatRelativeTime(offer.createdAt)}
            </span>
            <div className="flex items-center gap-1 text-accent-400 text-sm font-medium group-hover:gap-2 transition-all">
              Match borrower
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

interface FiatLendingOfferCardProps {
  offer: FiatLenderOffer;
  index?: number;
}

export function FiatLendingOfferCard({ offer, index = 0 }: FiatLendingOfferCardProps) {
  const chainInfo = offer.chainId ? getChainById(Number(offer.chainId)) : null;

  // Convert fiat amount to display value
  const fiatAmountUSD = convertFiatToUSD(offer.fiatAmountCents, offer.currency, offer.exchangeRateAtCreation);

  // Calculate remaining (available) and borrowed amounts
  const remainingCents = Number(offer.remainingAmountCents);
  const borrowedCents = Number(offer.borrowedAmountCents);

  // Calculate if offer is expired
  const isExpired = offer.status === FiatLenderOfferStatus.ACTIVE &&
    BigInt(Math.floor(Date.now() / 1000)) > offer.expireAt;

  const getStatusBadge = () => {
    if (isExpired) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Expired</span>;
    }
    switch (offer.status) {
      case FiatLenderOfferStatus.ACTIVE:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>;
      case FiatLenderOfferStatus.ACCEPTED:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-primary-500/20 text-primary-400">Accepted</span>;
      case FiatLenderOfferStatus.CANCELLED:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group"
    >
      <Link href={`/fiat-offer/${offer.offerId}`}>
        <div className="h-full glass-card p-6 rounded-2xl border border-green-500/20 hover:border-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Available to lend</span>
              <div className="flex items-center gap-2">
                {chainInfo && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                    <Network className="w-3 h-3" />
                    {chainInfo.name}
                  </span>
                )}
                {getStatusBadge()}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-400">
                {formatCurrency(offer.fiatAmountCents, offer.currency)}
              </span>
            </div>
            {offer.currency !== 'USD' && fiatAmountUSD > 0 && (
              <p className="text-sm text-gray-400 mt-1">~ {formatUSD(fiatAmountUSD)}</p>
            )}
          </div>

          {/* Asset Info Section */}
          <div className="mb-4 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Currency</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-green-400">{offer.currency}</span>
            </div>
          </div>

          {/* Available to Borrow */}
          <div className="mb-4 p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Available to Borrow</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white">
                {formatCurrency(BigInt(remainingCents), offer.currency)}
              </span>
            </div>
            {borrowedCents > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(BigInt(borrowedCents), offer.currency)} already borrowed
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-gray-400">Interest</span>
              </div>
              <span className="text-lg font-bold text-orange-400">
                {formatPercentage(offer.interestRate)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-xs text-gray-400">Duration</span>
              </div>
              <span className="text-lg font-semibold text-white">
                {formatDuration(offer.duration)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Posted {formatRelativeTime(offer.createdAt)}
            </span>
            <div className="flex items-center gap-1 text-green-400 text-sm font-medium group-hover:gap-2 transition-all">
              Match borrower
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
