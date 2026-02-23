'use client';

import { motion } from 'framer-motion';
import { Clock, Shield, TrendingUp, ArrowRight, Globe, ArrowRightLeft } from 'lucide-react';
import { LoanRequest, LoanRequestStatus } from '@/types';
import { formatTokenAmount, formatPercentage, formatDuration, formatRelativeTime, getTokenSymbol, getTokenDecimals } from '@/lib/utils';
import { useTokenPrice } from '@/hooks/useContracts';
import { getChainById, getTokenBySymbolForChain, getTokenByAddressForChain, findTokenChainId } from '@/config/contracts';
import Link from 'next/link';
import { Address } from 'viem';

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
  // Cross-chain detection:
  // Method 1: chainId field differs from marketplace chain
  const chainIdMismatch = request.chainId !== undefined
    && chainId !== undefined
    && Number(request.chainId) !== 0
    && Number(request.chainId) !== chainId;
  // Method 2: borrowAsset or collateralToken not found in the marketplace chain's token list
  const hasForeignTokens = chainId
    ? (!getTokenByAddressForChain(request.borrowAsset, chainId) || !getTokenByAddressForChain(request.collateralToken, chainId))
    : false;
  const isCrossChain = chainIdMismatch || hasForeignTokens;

  // Detect source chain (where collateral is locked).
  // Use same priority as the detail page: foreign token chain → request.chainId fallback.
  // The relay may map both tokens to the target chain, so findTokenChainId can return
  // the target chain — hence the fallback to request.chainId is critical.
  const borrowAssetChainId = findTokenChainId(request.borrowAsset);
  const collateralTokenChainId = findTokenChainId(request.collateralToken);
  const detectedSourceChainId = chainId !== undefined
    ? (
        borrowAssetChainId && borrowAssetChainId !== chainId
          ? borrowAssetChainId
          : collateralTokenChainId && collateralTokenChainId !== chainId
            ? collateralTokenChainId
            : (Number(request.chainId) !== 0 && Number(request.chainId) !== chainId)
              ? Number(request.chainId)
              : undefined
      )
    : undefined;
  const sourceChain = detectedSourceChainId ? getChainById(detectedSourceChainId) : undefined;
  const targetChain = chainId ? getChainById(chainId) : undefined;

  const collateralSymbol = getTokenSymbol(request.collateralToken, chainId);
  const borrowSymbol = getTokenSymbol(request.borrowAsset, chainId);
  const collateralDecimals = getTokenDecimals(request.collateralToken, chainId);
  const borrowDecimals = getTokenDecimals(request.borrowAsset, chainId);

  // For cross-chain, the borrowAsset address is from another chain.
  // Resolve to the current chain's equivalent token by symbol for price lookup.
  const borrowPriceAddress = isCrossChain && chainId
    ? (getTokenBySymbolForChain(borrowSymbol, chainId)?.address as Address | undefined) ?? request.borrowAsset
    : request.borrowAsset;

  // Get USD prices
  const { price: borrowPrice } = useTokenPrice(borrowPriceAddress, chainId);
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
        <div className={`h-full glass-card p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
          isCrossChain
            ? 'border-accent-500/30 hover:border-accent-500/50 hover:shadow-accent-500/10'
            : 'border-white/10 hover:border-primary-500/50 hover:shadow-primary-500/10'
        }`}>
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Borrower wants</span>
              <div className="flex items-center gap-1.5">
                {isCrossChain && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-500/20 text-accent-400 border border-accent-500/30">
                    <Globe className="w-3 h-3" />
                    Cross-Chain
                  </span>
                )}
                {request.status === LoanRequestStatus.PENDING && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>
                )}
              </div>
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

          {/* Cross-Chain Route Info — only show when we know the source chain */}
          {isCrossChain && sourceChain && (
            <div className="mb-4 p-3 rounded-xl bg-accent-500/5 border border-accent-500/10">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 text-center">
                  <p className="text-gray-500 mb-0.5">Collateral on</p>
                  <p className="text-accent-400 font-medium">{sourceChain?.name || 'Source Chain'}</p>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-accent-400/50 flex-shrink-0" />
                <div className="flex-1 text-center">
                  <p className="text-gray-500 mb-0.5">To be Funded on</p>
                  <p className="text-primary-400 font-medium">{targetChain?.name || 'This Chain'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Collateral Section */}
          <div className="mb-4 p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-accent-400" />
              <span className="text-xs text-gray-400">
                Using as collateral
                {isCrossChain && sourceChain && (
                  <span className="text-accent-400/60 ml-1">({sourceChain.name})</span>
                )}
              </span>
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
