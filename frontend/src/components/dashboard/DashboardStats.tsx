'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { StatCard } from '@/components/ui/Card';
import { DollarSign, TrendingUp, Shield, Activity } from 'lucide-react';
import { LoanStatus, LoanRequestStatus } from '@/types';
import { FiatLenderOfferStatus, FiatLoanStatus } from '@/hooks/useFiatLoan';
import { getTokenByAddress } from '@/config/contracts';
import {
  useFiatLenderOffersByLender,
  useFiatLoansByBorrower,
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
} from '@/stores/contractStore';
import { useAccount } from 'wagmi';

export function DashboardStats() {
  // Get all data from store
  const { address } = useAccount();
  const loanRequests = useLoanRequestsByBorrower(address);
  const lenderOffers = useLenderOffersByLender(address);
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);
  const fiatLenderOffers = useFiatLenderOffersByLender(address);
  const fiatLoanRequests = useFiatLoansByBorrower(address);

  // Filter active/pending items
  const activeBorrowedLoans = useMemo(() =>
    borrowedLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [borrowedLoans]
  );

  const activeLentLoans = useMemo(() =>
    lentLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [lentLoans]
  );

  const pendingRequests = useMemo(() =>
    loanRequests.filter(r => r.status === LoanRequestStatus.PENDING),
    [loanRequests]
  );

  const pendingOffers = useMemo(() =>
    lenderOffers.filter(o => o.status === LoanRequestStatus.PENDING),
    [lenderOffers]
  );

  const pendingFiatOffers = useMemo(() =>
    fiatLenderOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE),
    [fiatLenderOffers]
  );

  const pendingFiatRequests = useMemo(() =>
    fiatLoanRequests.filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER),
    [fiatLoanRequests]
  );

  // Calculate stats
  const stats = useMemo(() => {
    let totalBorrowedUSD = 0;
    let totalLentUSD = 0;
    let totalCollateralUSD = 0;

    activeBorrowedLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI') {
          totalBorrowedUSD += amount;
        }
      }
      const collateralInfo = getTokenByAddress(loan.collateralAsset);
      if (collateralInfo) {
        const collateralAmount = Number(formatUnits(
          loan.collateralAmount - loan.collateralReleased,
          collateralInfo.decimals
        ));
        if (collateralInfo.symbol === 'WETH') {
          totalCollateralUSD += collateralAmount * 2500;
        }
      }
    });

    activeLentLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI') {
          totalLentUSD += amount;
        }
      }
    });

    return {
      totalBorrowed: totalBorrowedUSD,
      totalLent: totalLentUSD,
      totalCollateral: totalCollateralUSD,
      activeBorrowedCount: activeBorrowedLoans.length,
      activeLentCount: activeLentLoans.length,
      pendingRequestsCount: pendingRequests.length,
      pendingOffersCount: pendingOffers.length,
      pendingFiatOffersCount: pendingFiatOffers.length,
      pendingFiatRequestsCount: pendingFiatRequests.length,
    };
  }, [activeBorrowedLoans, activeLentLoans, pendingRequests, pendingOffers, pendingFiatOffers, pendingFiatRequests]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      <StatCard
        label="Total Borrowed"
        value={`$${stats.totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        subValue={`${stats.activeBorrowedCount} active loan${stats.activeBorrowedCount !== 1 ? 's' : ''}`}
        icon={<DollarSign className="w-5 h-5" />}
      />
      <StatCard
        label="Total Lent"
        value={`$${stats.totalLent.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        subValue={`${stats.activeLentCount} active loan${stats.activeLentCount !== 1 ? 's' : ''}`}
        icon={<TrendingUp className="w-5 h-5" />}
      />
      <StatCard
        label="Collateral Locked"
        value={`$${stats.totalCollateral.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subValue="In active loans"
        icon={<Shield className="w-5 h-5" />}
      />
      <StatCard
        label="Pending"
        value={`${stats.pendingRequestsCount + stats.pendingOffersCount + stats.pendingFiatOffersCount + stats.pendingFiatRequestsCount}`}
        subValue={`${stats.pendingRequestsCount} crypto, ${stats.pendingFiatRequestsCount} fiat req, ${stats.pendingFiatOffersCount} fiat offers`}
        icon={<Activity className="w-5 h-5" />}
      />
    </motion.div>
  );
}
