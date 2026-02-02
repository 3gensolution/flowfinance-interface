'use client';

import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoanRequestCard, LenderOfferCard, FiatLoanRequestCard, FiatLenderOfferCard } from '@/components/loan/LoanCard';
import { AcceptFiatLenderOfferModal } from '@/components/loan/AcceptFiatLenderOfferModal';
import {
  usePendingLoanRequests,
  useActiveLenderOffers,
  usePendingFiatLoansFromStore,
  useActiveFiatLenderOffersFromStore,
} from '@/stores/contractStore';
import { useAcceptFiatLoanRequest, FiatLenderOffer } from '@/hooks/useFiatLoan';
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
    return storeLoanRequests.filter((r) => {
      if (address && r.borrower.toLowerCase() === address.toLowerCase()) return false;
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
    return storeLenderOffers.filter((o) => {
      if (address && o.lender.toLowerCase() === address.toLowerCase()) return false;
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
  onRefresh: () => void;
}

export function FiatRequestsTab({ isLoading, isVerifiedSupplier, onRefresh }: FiatRequestsTabProps) {
  const { address } = useAccount();
  const storeFiatLoans = usePendingFiatLoansFromStore();
  const { acceptFiatLoanRequest, isPending: isAcceptingFiat } = useAcceptFiatLoanRequest();

  const displayPendingFiatLoans = useMemo(() => {
    return storeFiatLoans.filter((loan) => {
      if (address && loan.borrower.toLowerCase() === address.toLowerCase()) return false;
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
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {displayPendingFiatLoans.map((loan) => (
        <FiatLoanRequestCard
          key={loan.loanId.toString()}
          loan={loan}
          isOwner={false}
          isSupplier={isVerifiedSupplier}
          onFund={isVerifiedSupplier ? async () => {
            try {
              await acceptFiatLoanRequest(loan.loanId);
              onRefresh();
            } catch (error) {
              console.error('Failed to fund fiat loan:', error);
            }
          } : undefined}
          loading={isAcceptingFiat}
        />
      ))}
    </div>
  );
}

// ============ Fiat Offers Tab ============
interface FiatOffersTabProps {
  isLoading: boolean;
  isVerifiedSupplier: boolean;
  onRefresh: () => void;
}

export function FiatOffersTab({ isLoading, isVerifiedSupplier, onRefresh }: FiatOffersTabProps) {
  const { address } = useAccount();
  const storeFiatLenderOffers = useActiveFiatLenderOffersFromStore();
  const [selectedFiatOffer, setSelectedFiatOffer] = useState<FiatLenderOffer | null>(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);

  const displayFiatLenderOffers = useMemo(() => {
    return storeFiatLenderOffers.filter((offer) => {
      if (address && offer.lender.toLowerCase() === address.toLowerCase()) return false;
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
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayFiatLenderOffers.map((offer) => (
          <FiatLenderOfferCard
            key={offer.offerId.toString()}
            offer={offer}
            isOwner={false}
            onAccept={() => {
              setSelectedFiatOffer(offer);
              setIsAcceptModalOpen(true);
            }}
          />
        ))}
      </div>

      <AcceptFiatLenderOfferModal
        offer={selectedFiatOffer}
        isOpen={isAcceptModalOpen}
        onClose={() => {
          setIsAcceptModalOpen(false);
          setSelectedFiatOffer(null);
        }}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </>
  );
}
