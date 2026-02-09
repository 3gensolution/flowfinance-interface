'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { DollarSign, TrendingUp, FileText, Percent } from 'lucide-react';
import { LoanStatus } from '@/types';
import { getTokenByAddress } from '@/config/contracts';
import {
  // useFiatLenderOffersByLender,
  // useFiatLoansByBorrower,
  // useLoanRequestsByBorrower,
  // useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
} from '@/stores/contractStore';
import { useAccount } from 'wagmi';

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  iconColor: string;
  valueColor?: string;
  delay?: number;
}

function SummaryCard({ label, value, subValue, icon, iconColor, valueColor = 'text-primary-400', delay = 0 }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${iconColor}`}>
          {icon}
        </div>
      </div>
      <div className={`text-3xl font-bold ${valueColor} mb-1`}>{value}</div>
      {subValue && <div className="text-sm text-gray-500">{subValue}</div>}
    </motion.div>
  );
}

export function SummaryCards() {
  const { address } = useAccount();
  // const loanRequests = useLoanRequestsByBorrower(address);
  // const lenderOffers = useLenderOffersByLender(address);
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);
  // const fiatLenderOffers = useFiatLenderOffersByLender(address);
  // const fiatLoanRequests = useFiatLoansByBorrower(address);

  // Filter active/pending items
  const activeBorrowedLoans = useMemo(() =>
    borrowedLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [borrowedLoans]
  );

  const activeLentLoans = useMemo(() =>
    lentLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [lentLoans]
  );

  // Calculate stats
  const stats = useMemo(() => {
    let totalBorrowedUSD = 0;
    let totalLentUSD = 0;
    let interestEarned = 0;

    // Calculate borrowed amounts
    activeBorrowedLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
          totalBorrowedUSD += amount;
        }
      }
    });

    // Calculate lent amounts and interest
    activeLentLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
          totalLentUSD += amount;
        }

        // Calculate interest earned (repaid - principal for completed loans)
        if (loan.status === LoanStatus.REPAID) {
          const repaid = Number(formatUnits(loan.amountRepaid, tokenInfo.decimals));
          interestEarned += repaid - amount;
        }
      }
    });

    // Also check repaid loans for interest
    const repaidLoans = lentLoans.filter(l => l.status === LoanStatus.REPAID);
    repaidLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const principal = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        const repaid = Number(formatUnits(loan.amountRepaid, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
          interestEarned += repaid - principal;
        }
      }
    });

    const totalActiveLoans = activeBorrowedLoans.length + activeLentLoans.length;

    return {
      totalBorrowed: totalBorrowedUSD,
      totalLent: totalLentUSD,
      activeLoans: totalActiveLoans,
      interestEarned: Math.max(0, interestEarned),
    };
  }, [activeBorrowedLoans, activeLentLoans, lentLoans]);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '$0.00';
    if (amount < 1000) return `$${amount.toFixed(2)}`;
    if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${(amount / 1000000).toFixed(2)}M`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <SummaryCard
        label="Total Borrowed"
        value={formatCurrency(stats.totalBorrowed)}
        subValue={`${activeBorrowedLoans.length} active loan${activeBorrowedLoans.length !== 1 ? 's' : ''}`}
        icon={<DollarSign className="w-5 h-5 text-primary-400" />}
        iconColor="bg-primary-500/10"
        valueColor="text-primary-400"
        delay={0}
      />
      <SummaryCard
        label="Total Lent"
        value={formatCurrency(stats.totalLent)}
        subValue={`${activeLentLoans.length} active loan${activeLentLoans.length !== 1 ? 's' : ''}`}
        icon={<TrendingUp className="w-5 h-5 text-teal-400" />}
        iconColor="bg-teal-500/10"
        valueColor="text-primary-400"
        delay={0.05}
      />
      <SummaryCard
        label="Active Loans"
        value={stats.activeLoans.toString()}
        subValue="Currently active"
        icon={<FileText className="w-5 h-5 text-primary-400" />}
        iconColor="bg-primary-500/10"
        valueColor="text-primary-400"
        delay={0.1}
      />
      <SummaryCard
        label="Interest Earned"
        value={formatCurrency(stats.interestEarned)}
        subValue="From lending"
        icon={<Percent className="w-5 h-5 text-orange-400" />}
        iconColor="bg-orange-500/10"
        valueColor="text-orange-400"
        delay={0.15}
      />
    </div>
  );
}
