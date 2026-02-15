'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActiveLoanCardWithData, LoanData } from '@/components/loan/ActiveLoanCardWithData';
import {
  DashboardLoanRequestCard,
  DashboardLenderOfferCard,
  DashboardFiatLoanRequestCard,
  DashboardFiatLenderOfferCard,
} from '@/components/dashboard/DashboardCards';
import { LoanStatus, LoanRequestStatus } from '@/types';
import { FiatLoanStatus, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import {
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
  useFiatLoansByBorrower,
  useFiatLenderOffersByLender,
} from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import { Plus } from 'lucide-react';

type Tab = 'crypto_borrow' | 'cash_borrow' | 'crypto_lend' | 'cash_lend';

export function ActiveLoansOffers() {
  const [activeTab, setActiveTab] = useState<Tab>('crypto_borrow');
  const { address } = useAccount();

  // Crypto loans and offers
  const loanRequests = useLoanRequestsByBorrower(address);
  const lenderOffers = useLenderOffersByLender(address);
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);

  // Fiat loans and offers
  const fiatLoans = useFiatLoansByBorrower(address);
  const fiatOffers = useFiatLenderOffersByLender(address);

  const openRepayModal = useUIStore((state) => state.openRepayModal);

  // Filter active crypto loans
  const activeBorrowedLoans = useMemo(() =>
    borrowedLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [borrowedLoans]
  );

  const activeLentLoans = useMemo(() =>
    lentLoans.filter(l => l.status === LoanStatus.ACTIVE),
    [lentLoans]
  );

  const pendingCryptoRequests = useMemo(() =>
    loanRequests.filter(r => r.status === LoanRequestStatus.PENDING),
    [loanRequests]
  );

  const pendingCryptoOffers = useMemo(() =>
    lenderOffers.filter(o => o.status === LoanRequestStatus.PENDING),
    [lenderOffers]
  );

  // Filter active and pending fiat loans
  const activeFiatLoans = useMemo(() =>
    fiatLoans.filter(l => l.status === FiatLoanStatus.ACTIVE || l.status === FiatLoanStatus.PENDING_SUPPLIER),
    [fiatLoans]
  );

  const activeFiatOffers = useMemo(() =>
    fiatOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE),
    [fiatOffers]
  );

  // Combine all active loans for "Borrowing Activity" tab
  const allActiveLoans = useMemo(() => {
    return [
      ...activeBorrowedLoans.map(loan => ({ loan, isBorrower: true, type: 'crypto' as const })),
      ...activeLentLoans.map(loan => ({ loan, isBorrower: false, type: 'crypto' as const })),
    ];
  }, [activeBorrowedLoans, activeLentLoans]);

  const tabs = [
    {
      id: 'crypto_borrow' as const,
      label: 'Crypto Loans',
      description: 'Borrow requests & active crypto loans',
      count: pendingCryptoRequests.length + allActiveLoans.filter(l => l.isBorrower).length,
    },
    {
      id: 'cash_borrow' as const,
      label: 'Cash Loans',
      description: 'Fiat/cash loan requests & active loans',
      count: activeFiatLoans.length,
    },
    {
      id: 'crypto_lend' as const,
      label: 'Crypto Offers',
      description: 'My crypto lending offers',
      count: pendingCryptoOffers.length,
    },
    {
      id: 'cash_lend' as const,
      label: 'Cash Offers',
      description: 'My fiat/cash lending offers',
      count: activeFiatOffers.length,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-8"
    >
      <h2 className="text-xl font-semibold mb-4">Active Loans & Offers</h2>

      {/* Tab Pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex flex-col items-start ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            </div>
            <span className={`text-xs mt-1 ${activeTab === tab.id ? 'text-white/80' : 'text-gray-500'}`}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* Crypto Borrow Tab */}
        {activeTab === 'crypto_borrow' && (
          <motion.div
            key="crypto_borrow"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {pendingCryptoRequests.length === 0 && allActiveLoans.filter(l => l.isBorrower).length === 0 ? (
              <EmptyState
                title="No Crypto Loans"
                description="You don't have any active crypto loans or borrow requests. Start borrowing crypto to see your activity here."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Borrow Crypto',
                  href: '/borrow',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="space-y-6">
                {/* Active Crypto Loans */}
                {allActiveLoans.filter(l => l.isBorrower).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Active Crypto Loans</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allActiveLoans.filter(l => l.isBorrower).map(({ loan, isBorrower }) => (
                        <LoanCard
                          key={loan.loanId.toString()}
                          loan={loan as LoanData}
                          isBorrower={isBorrower}
                          onRepay={isBorrower ? () => openRepayModal(loan.loanId) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Crypto Requests */}
                {pendingCryptoRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Pending Requests</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingCryptoRequests.map((request) => (
                        <DashboardLoanRequestCard
                          key={request.requestId.toString()}
                          request={request}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Cash Borrow Tab */}
        {activeTab === 'cash_borrow' && (
          <motion.div
            key="cash_borrow"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {activeFiatLoans.length === 0 ? (
              <EmptyState
                title="No Cash Loans"
                description="You don't have any active cash/fiat loans. Start borrowing cash to see your activity here."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Borrow Cash',
                  href: '/borrow',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeFiatLoans.map((loan) => (
                  <DashboardFiatLoanRequestCard
                    key={loan.loanId.toString()}
                    loan={loan}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Crypto Lend Tab */}
        {activeTab === 'crypto_lend' && (
          <motion.div
            key="crypto_lend"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {pendingCryptoOffers.length === 0 ? (
              <EmptyState
                title="No Crypto Lending Offers"
                description="You don't have any crypto lending offers yet. Start earning interest by creating crypto loan offers."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Create Crypto Offer',
                  href: '/lend',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingCryptoOffers.map((offer) => (
                  <DashboardLenderOfferCard
                    key={offer.offerId.toString()}
                    offer={offer}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Cash Lend Tab */}
        {activeTab === 'cash_lend' && (
          <motion.div
            key="cash_lend"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {activeFiatOffers.length === 0 ? (
              <EmptyState
                title="No Cash Lending Offers"
                description="You don't have any cash/fiat lending offers yet. Start earning interest by creating cash loan offers."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Create Cash Offer',
                  href: '/lend',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeFiatOffers.map((offer) => (
                  <DashboardFiatLenderOfferCard
                    key={offer.offerId.toString()}
                    offer={offer}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Internal Loan Card Component
interface LoanCardProps {
  loan: LoanData;
  isBorrower: boolean;
  onRepay?: () => void;
}

function LoanCard({ loan, isBorrower, onRepay }: LoanCardProps) {
  return (
    <ActiveLoanCardWithData
      loan={loan}
      isBorrower={isBorrower}
      onRepay={onRepay}
    />
  );
}
