'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ActiveLoanCardWithData, LoanData } from '@/components/loan/ActiveLoanCardWithData';
import {
  DashboardLoanRequestCard,
  DashboardLenderOfferCard,
  DashboardFiatLenderOfferCard,
  DashboardFiatLoanRequestCard,
} from '@/components/dashboard/DashboardCards';
import { LoanStatus, LoanRequestStatus } from '@/types';
import { useUserFiatLenderOffers, useUserFiatLoansAsBorrower, FiatLenderOfferStatus, FiatLoanStatus } from '@/hooks/useFiatLoan';
import {
  useFiatLenderOffersByLender,
  useFiatLoansByBorrower,
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
} from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import {
  TrendingUp,
  Plus,
  FileText,
  DollarSign,
  Loader2,
  RefreshCw,
  Banknote,
} from 'lucide-react';
import Link from 'next/link';

// ============ Borrowed Loans Tab ============
export function BorrowedLoansTab() {
  const { address } = useAccount();
  const borrowedLoans = useLoansByBorrower(address);
  const openRepayModal = useUIStore((state) => state.openRepayModal);

  const activeBorrowedLoans = useMemo(() =>
    borrowedLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [borrowedLoans]
  );

  if (activeBorrowedLoans.length === 0) {
    return (
      <Card className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Borrowed Loans</h3>
        <p className="text-gray-400 mb-4">
          You don&apos;t have any active loans as a borrower.
        </p>
        <Link href="/borrow">
          <Button icon={<Plus className="w-4 h-4" />}>Create Loan Request</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activeBorrowedLoans.map((loan) => (
        <ActiveLoanCardWithData
          key={loan.loanId.toString()}
          loan={loan as LoanData}
          isBorrower={true}
          onRepay={() => openRepayModal(loan.loanId)}
        />
      ))}
    </div>
  );
}

// ============ Lent Loans Tab ============
export function LentLoansTab() {
  const { address } = useAccount();
  const lentLoans = useLoansByLender(address);

  const activeLentLoans = useMemo(() =>
    lentLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [lentLoans]
  );

  if (activeLentLoans.length === 0) {
    return (
      <Card className="text-center py-12">
        <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Lent Loans</h3>
        <p className="text-gray-400 mb-4">
          You haven&apos;t funded any loans yet. Start earning interest!
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/marketplace">
            <Button variant="secondary">Browse Requests</Button>
          </Link>
          <Link href="/lend">
            <Button icon={<Plus className="w-4 h-4" />}>Create Offer</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activeLentLoans.map((loan) => (
        <ActiveLoanCardWithData
          key={loan.loanId.toString()}
          loan={loan as LoanData}
          isBorrower={false}
        />
      ))}
    </div>
  );
}

// ============ Loan Requests Tab ============
export function LoanRequestsTab() {
  const { address } = useAccount();
  const loanRequests = useLoanRequestsByBorrower(address);

  const pendingRequests = useMemo(() =>
    loanRequests.filter(r => r.status === LoanRequestStatus.PENDING),
    [loanRequests]
  );

  if (pendingRequests.length === 0) {
    return (
      <Card className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Pending Requests</h3>
        <p className="text-gray-400 mb-4">
          You don&apos;t have any pending loan requests.
        </p>
        <Link href="/borrow">
          <Button icon={<Plus className="w-4 h-4" />}>Create Request</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {pendingRequests.map((request) => (
        <DashboardLoanRequestCard
          key={request.requestId.toString()}
          request={request}
        />
      ))}
    </div>
  );
}

// ============ Lender Offers Tab ============
export function LenderOffersTab() {
  const { address } = useAccount();
  const lenderOffers = useLenderOffersByLender(address);

  const pendingOffers = useMemo(() =>
    lenderOffers.filter(o => o.status === LoanRequestStatus.PENDING),
    [lenderOffers]
  );

  if (pendingOffers.length === 0) {
    return (
      <Card className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Pending Offers</h3>
        <p className="text-gray-400 mb-4">
          You don&apos;t have any pending lender offers.
        </p>
        <Link href="/lend">
          <Button icon={<Plus className="w-4 h-4" />}>Create Offer</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {pendingOffers.map((offer) => (
        <DashboardLenderOfferCard
          key={offer.offerId.toString()}
          offer={offer}
        />
      ))}
    </div>
  );
}

// ============ Fiat Offers Tab ============
export function FiatOffersTab() {
  const { address } = useAccount();
  const fiatLenderOffers = useFiatLenderOffersByLender(address);
  const { isLoading, refetch } = useUserFiatLenderOffers(address);

  const pendingFiatOffers = useMemo(() =>
    fiatLenderOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE),
    [fiatLenderOffers]
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-400" />
        </div>
      ) : pendingFiatOffers.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingFiatOffers.map((offer) => (
            <DashboardFiatLenderOfferCard
              key={offer.offerId.toString()}
              offer={offer}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 border-green-500/20">
          <Banknote className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Active Fiat Offers</h3>
          <p className="text-gray-400 mb-4">
            You don&apos;t have any active fiat lender offers.
          </p>
          <Link href="/lend">
            <Button className="bg-green-600 hover:bg-green-700" icon={<Plus className="w-4 h-4" />}>
              Create Fiat Offer
            </Button>
          </Link>
        </Card>
      )}
    </>
  );
}

// ============ Fiat Requests Tab ============
export function FiatRequestsTab() {
  const { address } = useAccount();
  const fiatLoanRequests = useFiatLoansByBorrower(address);
  const { isLoading } = useUserFiatLoansAsBorrower(address);

  const pendingFiatRequests = useMemo(() =>
    fiatLoanRequests.filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER),
    [fiatLoanRequests]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (pendingFiatRequests.length === 0) {
    return (
      <Card className="text-center py-12 border-green-500/20">
        <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Pending Fiat Requests</h3>
        <p className="text-gray-400 mb-4">
          You don&apos;t have any pending fiat loan requests.
        </p>
        <Link href="/borrow">
          <Button className="bg-green-600 hover:bg-green-700" icon={<Plus className="w-4 h-4" />}>
            Create Fiat Loan Request
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {pendingFiatRequests.map((loan) => (
        <DashboardFiatLoanRequestCard
          key={loan.loanId.toString()}
          loan={loan}
        />
      ))}
    </div>
  );
}
