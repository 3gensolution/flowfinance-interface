'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActiveLoanCardWithData, LoanData } from '@/components/loan/ActiveLoanCardWithData';
import {
  DashboardLoanRequestCard,
  DashboardLenderOfferCard,
} from '@/components/dashboard/DashboardCards';
import { LoanStatus, LoanRequestStatus } from '@/types';
import {
  useLoanRequestsByBorrower,
  useLenderOffersByLender,
  useLoansByBorrower,
  useLoansByLender,
} from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import { Plus } from 'lucide-react';

type Tab = 'requests' | 'offers';

export function ActiveLoansOffers() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const { address } = useAccount();

  const loanRequests = useLoanRequestsByBorrower(address);
  const lenderOffers = useLenderOffersByLender(address);
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);
  const openRepayModal = useUIStore((state) => state.openRepayModal);

  // Filter active items
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

  // Combine borrowed and lent loans for "My Loan Requests" tab
  const allActiveLoans = useMemo(() => {
    return [
      ...activeBorrowedLoans.map(loan => ({ loan, isBorrower: true })),
      ...activeLentLoans.map(loan => ({ loan, isBorrower: false })),
    ];
  }, [activeBorrowedLoans, activeLentLoans]);

  const tabs = [
    {
      id: 'requests' as const,
      label: 'My Loan Requests',
      count: pendingRequests.length + allActiveLoans.length,
    },
    {
      id: 'offers' as const,
      label: 'My Loan Offers',
      count: pendingOffers.length,
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
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {pendingRequests.length === 0 && allActiveLoans.length === 0 ? (
              <EmptyState
                title="No Loan Requests"
                description="You don't have any loan requests yet. Start borrowing to see your activity here."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Create Loan Request',
                  href: '/borrow',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="space-y-6">
                {/* Active Loans Section */}
                {allActiveLoans.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Active Loans</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allActiveLoans.map(({ loan, isBorrower }) => (
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

                {/* Pending Requests Section */}
                {pendingRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Pending Requests</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingRequests.map((request) => (
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

        {activeTab === 'offers' && (
          <motion.div
            key="offers"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {pendingOffers.length === 0 ? (
              <EmptyState
                title="No Loan Offers"
                description="You don't have any lending offers yet. Start earning interest by creating a loan offer."
                lottieUrl="/empty.json"
                lottieWidth={180}
                lottieHeight={180}
                action={{
                  label: 'Create Loan Offer',
                  href: '/lend',
                  icon: <Plus className="w-4 h-4" />,
                }}
                size="md"
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingOffers.map((offer) => (
                  <DashboardLenderOfferCard
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
