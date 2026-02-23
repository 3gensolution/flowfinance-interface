'use client';

import { motion } from 'framer-motion';
import { Clock, Shield, TrendingUp, ArrowRight } from 'lucide-react';
import { LoanRequest, LoanRequestStatus } from '@/types';
import { formatTokenAmount, formatPercentage, formatDuration, formatRelativeTime, getTokenSymbol, getTokenDecimals } from '@/lib/utils';
import { useTokenPrice } from '@/hooks/useContracts';
import Link from 'next/link';

// Helper to format USD values
function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

// Calculate repayment amount
function calculateRepayment(principal: number, interestRateBps: bigint, durationSeconds: bigint): number {
  const interestRate = Number(interestRateBps) / 10000; // Convert bps to decimal
  const durationDays = Number(durationSeconds) / 86400;
  const dailyInterest = interestRate / 365;
  return principal * (1 + dailyInterest * durationDays);
}

interface CryptoBorrowRequestCardProps {
  request: LoanRequest;
  index?: number;
  chainId?: number;
}

export function CryptoBorrowRequestCard({ request, index = 0, chainId }: CryptoBorrowRequestCardProps) {
  const collateralSymbol = getTokenSymbol(request.collateralToken, chainId);
  const borrowSymbol = getTokenSymbol(request.borrowAsset, chainId);
  const collateralDecimals = getTokenDecimals(request.collateralToken, chainId);
  const borrowDecimals = getTokenDecimals(request.borrowAsset, chainId);

  // Get USD prices
  const { price: borrowPrice } = useTokenPrice(request.borrowAsset, chainId);
  const { price: collateralPrice } = useTokenPrice(request.collateralToken, chainId);

  // Calculate USD values
  const borrowAmount = Number(request.borrowAmount) / Math.pow(10, Number(borrowDecimals));
  const borrowUSD = borrowPrice ? borrowAmount * Number(borrowPrice) / 1e8 : 0;

  const collateralAmount = Number(request.collateralAmount) / Math.pow(10, Number(collateralDecimals));
  const collateralUSD = collateralPrice ? collateralAmount * Number(collateralPrice) / 1e8 : 0;

  // Calculate repayment
  const repaymentAmount = calculateRepayment(borrowAmount, request.interestRate, request.duration);
  const repaymentUSD = borrowPrice ? repaymentAmount * Number(borrowPrice) / 1e8 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group"
    >
      <Link href={`/loan/${request.requestId}`}>
        <div className="h-full glass-card p-6 rounded-2xl border border-white/10 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Borrower wants</span>
              {request.status === LoanRequestStatus.PENDING && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {formatTokenAmount(request.borrowAmount, borrowDecimals)}
              </span>
              <span className="text-lg text-primary-400">{borrowSymbol}</span>
            </div>
            {borrowUSD > 0 && (
              <p className="text-sm text-gray-400 mt-1">{formatUSD(borrowUSD)}</p>
            )}
          </div>

          {/* Collateral Section */}
          <div className="mb-4 p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-accent-400" />
              <span className="text-xs text-gray-400">Using as collateral</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white">
                {formatTokenAmount(request.collateralAmount, collateralDecimals)}
              </span>
              <span className="text-accent-400">{collateralSymbol}</span>
            </div>
            {collateralUSD > 0 && (
              <p className="text-xs text-gray-500">{formatUSD(collateralUSD)}</p>
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
                {formatPercentage(request.interestRate)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-xs text-gray-400">Duration</span>
              </div>
              <span className="text-lg font-semibold text-white">
                {formatDuration(request.duration)}
              </span>
            </div>
          </div>

          {/* Repayment Section */}
          {repaymentUSD > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-primary-500/10 to-accent-500/10 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Total Repayment</span>
                <span className="font-semibold text-white">
                  {repaymentAmount.toFixed(4)} {borrowSymbol}
                  <span className="text-gray-400 text-xs ml-1">({formatUSD(repaymentUSD)})</span>
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Posted {formatRelativeTime(request.createdAt)}
            </span>
            <div className="flex items-center gap-1 text-primary-400 text-sm font-medium group-hover:gap-2 transition-all">
              View request
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

