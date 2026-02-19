'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { LoanRequestStatus } from '@/types';
import { FiatLenderOfferStatus, FiatLoanStatus } from '@/hooks/useFiatLoan';
import {
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useFiatLenderOffersByLender,
  useFiatLoansByBorrower,
} from '@/stores/contractStore';
import { Clock, ArrowRight, FileText, TrendingUp, Banknote } from 'lucide-react';
import { isFiatSupportedOnActiveChain } from '@/config/contracts';
import Link from 'next/link';

interface PendingAction {
  type: 'loan_request' | 'loan_offer' | 'fiat_request' | 'fiat_offer';
  count: number;
  label: string;
  description: string;
  subtext: string;
  link: string;
  icon: React.ReactNode;
}

export function PendingActionsAlert() {
  const { address } = useAccount();
  const fiatSupported = isFiatSupportedOnActiveChain();

  const loanRequests = useLoanRequestsByBorrower(address);
  const lenderOffers = useLenderOffersByLender(address);
  const fiatLenderOffers = useFiatLenderOffersByLender(address);
  const fiatLoanRequests = useFiatLoansByBorrower(address);

  const pendingActions = useMemo(() => {
    const actions: PendingAction[] = [];

    // Pending crypto loan requests (user is borrower waiting for lender)
    const pendingRequests = loanRequests.filter(r => r.status === LoanRequestStatus.PENDING);
    if (pendingRequests.length > 0) {
      actions.push({
        type: 'loan_request',
        count: pendingRequests.length,
        label: 'Your Loan Requests',
        description: `${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} awaiting lenders`,
        subtext: 'Lenders on the marketplace can fund these requests',
        link: '/marketplace',
        icon: <FileText className="w-4 h-4" />,
      });
    }

    // Pending crypto lender offers (user is lender waiting for borrower)
    const pendingOffers = lenderOffers.filter(o => o.status === LoanRequestStatus.PENDING);
    if (pendingOffers.length > 0) {
      actions.push({
        type: 'loan_offer',
        count: pendingOffers.length,
        label: 'Your Lending Offers',
        description: `${pendingOffers.length} offer${pendingOffers.length > 1 ? 's' : ''} awaiting borrowers`,
        subtext: 'Borrowers on the marketplace can accept these offers',
        link: '/marketplace',
        icon: <TrendingUp className="w-4 h-4" />,
      });
    }

    // Fiat actions only on Base
    if (fiatSupported) {
      // Pending fiat loan requests (user is borrower waiting for supplier)
      const pendingFiatRequests = fiatLoanRequests.filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER);
      if (pendingFiatRequests.length > 0) {
        actions.push({
          type: 'fiat_request',
          count: pendingFiatRequests.length,
          label: 'Your Fiat Loan Requests',
          description: `${pendingFiatRequests.length} request${pendingFiatRequests.length > 1 ? 's' : ''} awaiting suppliers`,
          subtext: 'Fiat suppliers can fund these loan requests',
          link: '/marketplace',
          icon: <Banknote className="w-4 h-4" />,
        });
      }

      // Active fiat lender offers (user is supplier waiting for borrowers)
      const activeFiatOffers = fiatLenderOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE);
      if (activeFiatOffers.length > 0) {
        actions.push({
          type: 'fiat_offer',
          count: activeFiatOffers.length,
          label: 'Your Fiat Lending Offers',
          description: `${activeFiatOffers.length} offer${activeFiatOffers.length > 1 ? 's' : ''} available on marketplace`,
          subtext: 'Borrowers can accept these fiat lending offers',
          link: '/marketplace',
          icon: <Banknote className="w-4 h-4" />,
        });
      }
    }

    return actions;
  }, [loanRequests, lenderOffers, fiatLenderOffers, fiatLoanRequests, fiatSupported]);

  if (pendingActions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-8"
    >
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary-400" />
        Awaiting Matches
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        These are your offers and requests that are waiting for counterparties on the marketplace.
      </p>

      <div className="space-y-3">
        {pendingActions.map((action, index) => (
          <motion.div
            key={action.type}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <Link href={action.link}>
              <div className="glass-card p-4 border border-primary-500/20 hover:border-primary-500/40 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
                      {action.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{action.label}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-500/20 text-primary-400">
                          {action.count}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{action.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{action.subtext}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
