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
import { Plus, Coins, Banknote, HandCoins, Wallet, ArrowRightLeft } from 'lucide-react';
import { isFiatSupportedOnActiveChain } from '@/config/contracts';

type Tab = 'crypto_borrow' | 'cash_borrow' | 'crypto_lend' | 'cash_lend';

export function ActiveLoansOffers() {
  const [activeTab, setActiveTab] = useState<Tab>('crypto_borrow');
  const { address } = useAccount();
  const fiatSupported = isFiatSupportedOnActiveChain();

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

  const allTabs: { id: Tab; label: string; shortLabel: string; icon: React.ReactNode; count: number; activeColor: string; fiatOnly?: boolean }[] = [
    {
      id: 'crypto_borrow',
      label: 'Crypto Loans',
      shortLabel: 'Crypto',
      icon: <Coins className="w-4 h-4 flex-shrink-0" />,
      count: pendingCryptoRequests.length + activeBorrowedLoans.length,
      activeColor: 'bg-primary-500 shadow-primary-500/25',
    },
    {
      id: 'cash_borrow',
      label: 'Cash Loans',
      shortLabel: 'Cash',
      icon: <Banknote className="w-4 h-4 flex-shrink-0" />,
      count: activeFiatLoans.length,
      activeColor: 'bg-green-600 shadow-green-600/25',
      fiatOnly: true,
    },
    {
      id: 'crypto_lend',
      label: 'Crypto Offers',
      shortLabel: 'Offers',
      icon: <HandCoins className="w-4 h-4 flex-shrink-0" />,
      count: pendingCryptoOffers.length + activeLentLoans.length,
      activeColor: 'bg-accent-500 shadow-accent-500/25',
    },
    {
      id: 'cash_lend',
      label: 'Cash Offers',
      shortLabel: 'Fiat',
      icon: <Wallet className="w-4 h-4 flex-shrink-0" />,
      count: activeFiatOffers.length,
      activeColor: 'bg-orange-500 shadow-orange-500/25',
      fiatOnly: true,
    },
  ];

  // Hide fiat tabs on non-Base chains
  const tabs = fiatSupported ? allTabs : allTabs.filter(t => !t.fiatOnly);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-8"
    >
      <h2 className="text-xl font-semibold mb-4">Active Loans & Offers</h2>

      {/* Tab Bar — marketplace style */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 scrollbar-hide">
        <div className="inline-flex rounded-2xl p-1.5 bg-white/5 border border-white/10 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-medium
                transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? `${tab.activeColor} text-white shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* Crypto Borrow Tab */}
        {activeTab === 'crypto_borrow' && (
          <motion.div
            key="crypto_borrow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {pendingCryptoRequests.length === 0 && activeBorrowedLoans.length === 0 ? (
              <EmptyState
                title="No Crypto Loans"
                description="You don't have any active crypto loans or borrow requests."
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
                {activeBorrowedLoans.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Active Loans</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeBorrowedLoans.map((loan) => (
                        <ActiveLoanCardWithData
                          key={loan.loanId.toString()}
                          loan={loan as LoanData}
                          isBorrower={true}
                          onRepay={() => openRepayModal(loan.loanId)}
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeFiatLoans.length === 0 ? (
              <EmptyState
                title="No Cash Loans"
                description="You don't have any active cash/fiat loans."
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {pendingCryptoOffers.length === 0 && activeLentLoans.length === 0 ? (
              <EmptyState
                title="No Crypto Lending Offers"
                description="You don't have any crypto lending offers yet."
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
              <div className="space-y-6">
                {/* Active Lent Loans */}
                {activeLentLoans.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Active Lending</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeLentLoans.map((loan) => (
                        <ActiveLoanCardWithData
                          key={loan.loanId.toString()}
                          loan={loan as LoanData}
                          isBorrower={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Crypto Offers */}
                {pendingCryptoOffers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Pending Offers</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingCryptoOffers.map((offer) => (
                        <DashboardLenderOfferCard
                          key={offer.offerId.toString()}
                          offer={offer}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Cash Lend Tab */}
        {activeTab === 'cash_lend' && (
          <motion.div
            key="cash_lend"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeFiatOffers.length === 0 ? (
              <EmptyState
                title="No Cash Lending Offers"
                description="You don't have any cash/fiat lending offers yet."
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
