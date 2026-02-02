'use client';

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { LoanStatus, LoanRequestStatus } from '@/types';
import { FiatLenderOfferStatus, FiatLoanStatus, useUserFiatLenderOffers, useUserFiatLoansAsBorrower } from '@/hooks/useFiatLoan';
import { useUserDashboardData } from '@/hooks/useContracts';
import { DollarSign, Banknote } from 'lucide-react';

export type Tab = 'borrowing' | 'lending' | 'requests' | 'offers' | 'fiatOffers' | 'fiatRequests';

interface TabButtonsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabButtons({ activeTab, onTabChange }: TabButtonsProps) {
  const { address } = useAccount();

  // Fetch data directly from wagmi hooks
  const { borrowedLoans, lentLoans, loanRequests, lenderOffers } = useUserDashboardData(address);
  const { data: fiatLenderOffers } = useUserFiatLenderOffers(address);
  const { data: fiatLoanRequests } = useUserFiatLoansAsBorrower(address);

  const counts = useMemo(() => ({
    borrowed: borrowedLoans.filter(l => l.status === LoanStatus.ACTIVE).length,
    lent: lentLoans.filter(l => l.status === LoanStatus.ACTIVE).length,
    requests: loanRequests.filter(r => r.status === LoanRequestStatus.PENDING).length,
    offers: lenderOffers.filter(o => o.status === LoanRequestStatus.PENDING).length,
    fiatOffers: (fiatLenderOffers || []).filter(o => o.status === FiatLenderOfferStatus.ACTIVE).length,
    fiatRequests: (fiatLoanRequests || []).filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER).length,
  }), [borrowedLoans, lentLoans, loanRequests, lenderOffers, fiatLenderOffers, fiatLoanRequests]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-wrap gap-2 mb-6"
    >
      <Button
        variant={activeTab === 'borrowing' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('borrowing')}
      >
        My Borrowed ({counts.borrowed})
      </Button>
      <Button
        variant={activeTab === 'lending' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('lending')}
      >
        My Lent ({counts.lent})
      </Button>
      <Button
        variant={activeTab === 'requests' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('requests')}
      >
        My Requests ({counts.requests})
      </Button>
      <Button
        variant={activeTab === 'offers' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('offers')}
      >
        Crypto Offers ({counts.offers})
      </Button>
      <Button
        variant={activeTab === 'fiatOffers' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('fiatOffers')}
        className={activeTab === 'fiatOffers' ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        <Banknote className="w-4 h-4 mr-1" />
        Fiat Offers ({counts.fiatOffers})
      </Button>
      <Button
        variant={activeTab === 'fiatRequests' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onTabChange('fiatRequests')}
        className={activeTab === 'fiatRequests' ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        <DollarSign className="w-4 h-4 mr-1" />
        Fiat Requests ({counts.fiatRequests})
      </Button>
    </motion.div>
  );
}
