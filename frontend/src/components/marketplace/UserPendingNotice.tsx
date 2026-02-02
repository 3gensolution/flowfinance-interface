'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Clock, Banknote } from 'lucide-react';
import Link from 'next/link';
import {
  usePendingLoanRequests,
  useActiveLenderOffers,
  usePendingFiatLoansFromStore,
  useActiveFiatLenderOffersFromStore,
} from '@/stores/contractStore';

// ============ Crypto Notices ============
export function CryptoRequestsUserNotice() {
  const { address } = useAccount();
  const storeLoanRequests = usePendingLoanRequests();

  const userPendingRequests = useMemo(() => {
    if (!address) return 0;
    return storeLoanRequests.filter((r) =>
      r.borrower.toLowerCase() === address.toLowerCase()
    ).length;
  }, [storeLoanRequests, address]);

  if (userPendingRequests === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-primary-400 font-medium">
            You have {userPendingRequests} pending loan request{userPendingRequests > 1 ? 's' : ''} awaiting funding
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Your own requests are not shown here as you cannot fund them yourself. They are visible to other lenders who can fund them.
          </p>
          <Link href="/dashboard" className="text-primary-400 text-sm hover:underline mt-2 inline-block">
            View your requests in Dashboard →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function CryptoOffersUserNotice() {
  const { address } = useAccount();
  const storeLenderOffers = useActiveLenderOffers();

  const userPendingOffers = useMemo(() => {
    if (!address) return 0;
    return storeLenderOffers.filter((o) =>
      o.lender.toLowerCase() === address.toLowerCase()
    ).length;
  }, [storeLenderOffers, address]);

  if (userPendingOffers === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-accent-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-accent-400 font-medium">
            You have {userPendingOffers} pending lender offer{userPendingOffers > 1 ? 's' : ''} awaiting acceptance
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Your own offers are not shown here as you cannot accept them yourself. They are visible to borrowers who can accept them.
          </p>
          <Link href="/dashboard" className="text-accent-400 text-sm hover:underline mt-2 inline-block">
            View your offers in Dashboard →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ============ Fiat Notices ============
export function FiatRequestsUserNotice() {
  const { address } = useAccount();
  const storeFiatLoans = usePendingFiatLoansFromStore();

  const userPendingFiatLoans = useMemo(() => {
    if (!address) return 0;
    return storeFiatLoans.filter((loan) =>
      loan.borrower.toLowerCase() === address.toLowerCase()
    ).length;
  }, [storeFiatLoans, address]);

  if (userPendingFiatLoans === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-green-400 font-medium">
            You have {userPendingFiatLoans} pending fiat loan request{userPendingFiatLoans > 1 ? 's' : ''} awaiting funding
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Your own requests are not shown here. They are visible to verified fiat suppliers who can fund them.
          </p>
          <Link href="/dashboard" className="text-green-400 text-sm hover:underline mt-2 inline-block">
            View your requests in Dashboard →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function FiatOffersUserNotice() {
  const { address } = useAccount();
  const storeFiatLenderOffers = useActiveFiatLenderOffersFromStore();

  const userPendingFiatOffers = useMemo(() => {
    if (!address) return 0;
    return storeFiatLenderOffers.filter((offer) =>
      offer.lender.toLowerCase() === address.toLowerCase()
    ).length;
  }, [storeFiatLenderOffers, address]);

  if (userPendingFiatOffers === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-green-400 font-medium">
            You have {userPendingFiatOffers} active fiat lender offer{userPendingFiatOffers > 1 ? 's' : ''} awaiting acceptance
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Your own offers are not shown here as you cannot accept them yourself. They are visible to borrowers who can accept them.
          </p>
          <Link href="/dashboard" className="text-green-400 text-sm hover:underline mt-2 inline-block">
            View your offers in Dashboard →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

interface SupplierNoticeProps {
  isVerifiedSupplier: boolean;
}

export function SupplierNotice({ isVerifiedSupplier }: SupplierNoticeProps) {
  if (isVerifiedSupplier) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
        <Banknote className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-yellow-400 font-medium">
            Become a Fiat Supplier to Fund Loans
          </p>
          <p className="text-gray-400 text-sm mt-1">
            To fund fiat loan requests, you need to register and get verified as a fiat supplier.
          </p>
          <Link href="/dashboard" className="text-yellow-400 text-sm hover:underline mt-2 inline-block">
            Register as Supplier →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
