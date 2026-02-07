'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoanRequestCard, LenderOfferCard, FiatLoanRequestCard, FiatLenderOfferCard } from '@/components/loan/LoanCard';
import {
  usePendingLoanRequests,
  useActiveLenderOffers,
  usePendingFiatLoansFromStore,
  useActiveFiatLenderOffersFromStore,
} from '@/stores/contractStore';
import { LoanRequestStatus } from '@/types';
import { FiatLoanStatus, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import { FileText, TrendingUp, Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';

// ============ Crypto Requests Tab ============
interface CryptoRequestsTabProps {
  isLoading: boolean;
}

export function CryptoRequestsTab({ isLoading }: CryptoRequestsTabProps) {
  const { address } = useAccount();
  const storeLoanRequests = usePendingLoanRequests();

  const loanRequests = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return storeLoanRequests.filter((r) => {
      // Filter out user's own requests
      if (address && r.borrower.toLowerCase() === address.toLowerCase()) return false;
      // Only show pending and not expired
      if (r.status !== LoanRequestStatus.PENDING) return false;
      if (r.expireAt <= now) return false;
      return true;
    });
  }, [storeLoanRequests, address]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (loanRequests.length === 0) {
    return (
      <Card className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Requests</h3>
        <p className="text-gray-400 mb-4">
          There are no pending loan requests at the moment.
        </p>
        <Link href="/borrow">
          <Button>Create a Request</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {loanRequests.map((request) => (
        <LoanRequestCard
          key={request.requestId.toString()}
          request={request}
          isOwner={false}
        />
      ))}
    </div>
  );
}

// ============ Crypto Offers Tab ============
interface CryptoOffersTabProps {
  isLoading: boolean;
}

export function CryptoOffersTab({ isLoading }: CryptoOffersTabProps) {
  const { address } = useAccount();
  const storeLenderOffers = useActiveLenderOffers();

  const lenderOffers = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return storeLenderOffers.filter((o) => {
      // Filter out user's own offers
      if (address && o.lender.toLowerCase() === address.toLowerCase()) return false;
      // Only show pending and not expired
      if (o.status !== LoanRequestStatus.PENDING) return false;
      if (o.expireAt <= now) return false;
      return true;
    });
  }, [storeLenderOffers, address]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (lenderOffers.length === 0) {
    return (
      <Card className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Offers</h3>
        <p className="text-gray-400 mb-4">
          There are no pending lender offers at the moment.
        </p>
        <Link href="/lend">
          <Button>Create an Offer</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {lenderOffers.map((offer) => (
        <LenderOfferCard
          key={offer.offerId.toString()}
          offer={offer}
          isOwner={false}
        />
      ))}
    </div>
  );
}

// ============ Fiat Requests Tab ============
interface FiatRequestsTabProps {
  isLoading: boolean;
  isVerifiedSupplier: boolean;
}

export function FiatRequestsTab({ isLoading, isVerifiedSupplier }: FiatRequestsTabProps) {
  const { address } = useAccount();
  const storeFiatLoans = usePendingFiatLoansFromStore();

  const displayPendingFiatLoans = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return storeFiatLoans.filter((loan) => {
      // Filter out user's own loans
      if (address && loan.borrower.toLowerCase() === address.toLowerCase()) return false;
      // Only show pending
      if (loan.status !== FiatLoanStatus.PENDING_SUPPLIER) return false;
      // Calculate expiration (7 days from creation)
      const expiresAt = BigInt(Number(loan.createdAt) + (7 * 24 * 60 * 60));
      if (expiresAt <= now) return false;
      return true;
    });
  }, [storeFiatLoans, address]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (displayPendingFiatLoans.length === 0) {
    return (
      <Card className="text-center py-12 border-green-500/20">
        <Banknote className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Pending Fiat Loan Requests</h3>
        <p className="text-gray-400 mb-4">
          There are no pending fiat loan requests at the moment.
        </p>
        <Link href="/borrow">
          <Button className="bg-green-600 hover:bg-green-700">Create a Fiat Loan Request</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Supplier Notice for non-suppliers */}
      {!isVerifiedSupplier && displayPendingFiatLoans.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-yellow-400 font-medium">Supplier Registration Required</p>
              <p className="text-sm text-gray-400">
                To fund fiat loan requests, you need to register and get verified as a supplier.
              </p>
            </div>
            <Link href="/dashboard#supplier">
              <Button size="sm" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/50">
                Register
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayPendingFiatLoans.map((loan) => (
          <FiatLoanRequestCard
            key={loan.loanId.toString()}
            loan={loan}
            isOwner={false}
            isSupplier={isVerifiedSupplier}
          />
        ))}
      </div>
    </div>
  );
}

// ============ Fiat Offers Tab ============
interface FiatOffersTabProps {
  isLoading: boolean;
  isVerifiedSupplier: boolean;
}

export function FiatOffersTab({ isLoading, isVerifiedSupplier }: FiatOffersTabProps) {
  const { address } = useAccount();
  const storeFiatLenderOffers = useActiveFiatLenderOffersFromStore();

  const displayFiatLenderOffers = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return storeFiatLenderOffers.filter((offer) => {
      // Filter out user's own offers
      if (address && offer.lender.toLowerCase() === address.toLowerCase()) return false;
      // Only show active and not expired
      if (offer.status !== FiatLenderOfferStatus.ACTIVE) return false;
      if (offer.expireAt <= now) return false;
      return true;
    });
  }, [storeFiatLenderOffers, address]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (displayFiatLenderOffers.length === 0) {
    return (
      <Card className="text-center py-12 border-green-500/20">
        <TrendingUp className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Fiat Lender Offers</h3>
        <p className="text-gray-400 mb-4">
          There are no active fiat lender offers at the moment.
        </p>
        {isVerifiedSupplier ? (
          <Link href="/lend">
            <Button className="bg-green-600 hover:bg-green-700">Create a Fiat Lender Offer</Button>
          </Link>
        ) : (
          <p className="text-sm text-gray-500">
            Only verified fiat suppliers can create fiat lender offers.
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {displayFiatLenderOffers.map((offer) => (
        <FiatLenderOfferCard
          key={offer.offerId.toString()}
          offer={offer}
          isOwner={false}
        />
      ))}
    </div>
  );
}
