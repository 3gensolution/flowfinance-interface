'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'viem';
import { LoanStatus, LoanRequestStatus } from '@/types';
import { FiatLenderOfferStatus, FiatLoanStatus } from '@/hooks/useFiatLoan';
import { getTokenByAddress } from '@/config/contracts';
import {
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
  useFiatLenderOffersByLender,
  useFiatLoansByBorrower,
} from '@/stores/contractStore';
import {
  ChevronDown,
  TrendingDown,
  TrendingUp,
  DollarSign,
  FileText,
  Clock,
  Percent,
} from 'lucide-react';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueColor?: string;
}

function StatItem({ icon, label, value, valueColor = 'text-white' }: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}

export function ExpandedStatsAccordion() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { address } = useAccount();

  const loanRequests = useLoanRequestsByBorrower(address);
  const lenderOffers = useLenderOffersByLender(address);
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);
  const fiatLenderOffers = useFiatLenderOffersByLender(address);
  const fiatLoanRequests = useFiatLoansByBorrower(address);

  const borrowingStats = useMemo(() => {
    let totalBorrowedUSD = 0;
    let activeLoans = 0;
    let pendingRequests = 0;

    // Active borrowed loans
    borrowedLoans.forEach(loan => {
      if (loan.status === LoanStatus.ACTIVE) {
        activeLoans++;
        const tokenInfo = getTokenByAddress(loan.borrowAsset);
        if (tokenInfo) {
          const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
          if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
            totalBorrowedUSD += amount;
          }
        }
      }
    });

    // Pending loan requests
    loanRequests.forEach(request => {
      if (request.status === LoanRequestStatus.PENDING) {
        pendingRequests++;
      }
    });

    // Fiat loan requests
    const pendingFiatRequests = fiatLoanRequests.filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER).length;

    return {
      totalBorrowed: totalBorrowedUSD,
      activeLoans,
      pendingRequests,
      pendingFiatRequests,
    };
  }, [borrowedLoans, loanRequests, fiatLoanRequests]);

  const lendingStats = useMemo(() => {
    let totalLentUSD = 0;
    let activeOffers = 0;
    let interestReceived = 0;
    let interestAccruing = 0;

    // Active lent loans
    lentLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const principal = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));

        if (loan.status === LoanStatus.ACTIVE) {
          if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
            totalLentUSD += principal;
            // Calculate accruing interest (simplified)
            const interestRate = Number(loan.interestRate) / 10000; // Convert from basis points
            const duration = Number(loan.duration) / (365 * 24 * 60 * 60); // Convert to years
            interestAccruing += principal * interestRate * duration;
          }
        }

        if (loan.status === LoanStatus.REPAID) {
          const repaid = Number(formatUnits(loan.amountRepaid, tokenInfo.decimals));
          if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI' || tokenInfo.symbol === 'USDT') {
            interestReceived += repaid - principal;
          }
        }
      }
    });

    // Pending lender offers
    lenderOffers.forEach(offer => {
      if (offer.status === LoanRequestStatus.PENDING) {
        activeOffers++;
      }
    });

    // Fiat lender offers
    const activeFiatOffers = fiatLenderOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE).length;

    return {
      totalLent: totalLentUSD,
      activeOffers,
      activeFiatOffers,
      interestReceived: Math.max(0, interestReceived),
      interestAccruing: Math.max(0, interestAccruing),
    };
  }, [lentLoans, lenderOffers, fiatLenderOffers]);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '$0.00';
    if (amount < 1000) return `$${amount.toFixed(2)}`;
    if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${(amount / 1000000).toFixed(2)}M`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mb-8"
    >
      {/* Accordion Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Lending & Borrowing Stats</h2>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        </motion.div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6 rounded-t-none border-t-0 mt-[-1px]">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Borrowing Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-primary-500/10">
                      <TrendingDown className="w-4 h-4 text-primary-400" />
                    </div>
                    <h3 className="font-semibold">Borrowing Summary</h3>
                  </div>
                  <div className="space-y-1">
                    <StatItem
                      icon={<DollarSign className="w-4 h-4" />}
                      label="Total Borrowed"
                      value={formatCurrency(borrowingStats.totalBorrowed)}
                      valueColor="text-primary-400"
                    />
                    <StatItem
                      icon={<FileText className="w-4 h-4" />}
                      label="Active Loans"
                      value={borrowingStats.activeLoans}
                    />
                    <StatItem
                      icon={<Clock className="w-4 h-4" />}
                      label="Pending Requests"
                      value={borrowingStats.pendingRequests}
                      valueColor={borrowingStats.pendingRequests > 0 ? 'text-amber-400' : 'text-gray-500'}
                    />
                    <StatItem
                      icon={<Clock className="w-4 h-4" />}
                      label="Pending Fiat Requests"
                      value={borrowingStats.pendingFiatRequests}
                      valueColor={borrowingStats.pendingFiatRequests > 0 ? 'text-amber-400' : 'text-gray-500'}
                    />
                  </div>
                </div>

                {/* Lending Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-teal-500/10">
                      <TrendingUp className="w-4 h-4 text-teal-400" />
                    </div>
                    <h3 className="font-semibold">Lending Summary</h3>
                  </div>
                  <div className="space-y-1">
                    <StatItem
                      icon={<DollarSign className="w-4 h-4" />}
                      label="Total Lent"
                      value={formatCurrency(lendingStats.totalLent)}
                      valueColor="text-teal-400"
                    />
                    <StatItem
                      icon={<FileText className="w-4 h-4" />}
                      label="Active Offers"
                      value={lendingStats.activeOffers + lendingStats.activeFiatOffers}
                    />
                    <StatItem
                      icon={<Percent className="w-4 h-4" />}
                      label="Interest Received"
                      value={formatCurrency(lendingStats.interestReceived)}
                      valueColor="text-orange-400"
                    />
                    <StatItem
                      icon={<Percent className="w-4 h-4" />}
                      label="Interest Accruing"
                      value={formatCurrency(lendingStats.interestAccruing)}
                      valueColor="text-green-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
