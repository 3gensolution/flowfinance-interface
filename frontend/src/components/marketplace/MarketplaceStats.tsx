'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import {
  usePendingLoanRequests,
  useActiveLenderOffers,
} from '@/stores/contractStore';
import { useFiatLoanStats } from '@/hooks/useFiatLoan';
import { getTokenDecimals } from '@/lib/utils';

// ============ Crypto Stats ============
export function CryptoMarketplaceStats() {
  const storeLoanRequests = usePendingLoanRequests();
  const storeLenderOffers = useActiveLenderOffers();

  const stats = useMemo(() => {
    const allPendingRequests = storeLoanRequests;
    const allPendingOffers = storeLenderOffers;

    // Calculate average interest rate
    let totalInterestRate = BigInt(0);
    let itemCount = 0;

    allPendingRequests.forEach(r => {
      totalInterestRate += r.interestRate;
      itemCount++;
    });

    allPendingOffers.forEach(o => {
      totalInterestRate += o.interestRate;
      itemCount++;
    });

    const avgInterestRate = itemCount > 0
      ? (Number(totalInterestRate) / itemCount / 100).toFixed(1)
      : '0.0';

    // Calculate total volume
    let totalVolumeUsdc = 0;
    allPendingRequests.forEach(r => {
      const decimals = getTokenDecimals(r.borrowAsset);
      const amount = Number(r.borrowAmount) / Math.pow(10, decimals);
      totalVolumeUsdc += amount;
    });

    allPendingOffers.forEach(o => {
      const decimals = getTokenDecimals(o.lendAsset);
      const amount = Number(o.lendAmount) / Math.pow(10, decimals);
      totalVolumeUsdc += amount;
    });

    const formattedVolume = totalVolumeUsdc >= 1000000
      ? `$${(totalVolumeUsdc / 1000000).toFixed(1)}M`
      : totalVolumeUsdc >= 1000
        ? `$${(totalVolumeUsdc / 1000).toFixed(1)}K`
        : `$${totalVolumeUsdc.toFixed(0)}`;

    return {
      activeRequests: allPendingRequests.length,
      activeOffers: allPendingOffers.length,
      avgInterestRate: `${avgInterestRate}%`,
      totalVolume: formattedVolume
    };
  }, [storeLoanRequests, storeLenderOffers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      <Card className="text-center">
        <p className="text-gray-400 text-sm">Active Requests</p>
        <p className="text-2xl font-bold text-primary-400">
          {stats.activeRequests}
        </p>
      </Card>
      <Card className="text-center">
        <p className="text-gray-400 text-sm">Active Offers</p>
        <p className="text-2xl font-bold text-accent-400">
          {stats.activeOffers}
        </p>
      </Card>
      <Card className="text-center">
        <p className="text-gray-400 text-sm">Avg Interest Rate</p>
        <p className="text-2xl font-bold text-green-400">{stats.avgInterestRate}</p>
      </Card>
      <Card className="text-center">
        <p className="text-gray-400 text-sm">Total Volume</p>
        <p className="text-2xl font-bold text-yellow-400">{stats.totalVolume}</p>
      </Card>
    </motion.div>
  );
}

// ============ Fiat Stats ============
export function FiatMarketplaceStats() {
  const { data: fiatStats } = useFiatLoanStats();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      <Card className="text-center border-green-500/20">
        <p className="text-gray-400 text-sm">Pending Requests</p>
        <p className="text-2xl font-bold text-green-400">
          {fiatStats?.pendingCount || 0}
        </p>
      </Card>
      <Card className="text-center border-green-500/20">
        <p className="text-gray-400 text-sm">Active Loans</p>
        <p className="text-2xl font-bold text-green-400">
          {fiatStats?.activeCount || 0}
        </p>
      </Card>
      <Card className="text-center border-green-500/20">
        <p className="text-gray-400 text-sm">Avg Interest Rate</p>
        <p className="text-2xl font-bold text-green-400">
          {fiatStats?.avgInterestRate?.toFixed(1) || '0'}%
        </p>
      </Card>
      <Card className="text-center border-green-500/20">
        <p className="text-gray-400 text-sm">Total Volume</p>
        <p className="text-2xl font-bold text-green-400">
          ${((fiatStats?.totalPendingVolume || 0) + (fiatStats?.totalActiveVolume || 0)).toLocaleString()}
        </p>
      </Card>
    </motion.div>
  );
}
