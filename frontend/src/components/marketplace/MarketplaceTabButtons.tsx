'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { LoanRequestStatus } from '@/types';
import {
  useNextLoanRequestId,
  useNextLenderOfferId,
  useBatchLoanRequests,
  useBatchLenderOffers,
} from '@/hooks/useContracts';
import {
  usePendingFiatLoansWithDetails,
  useActiveFiatLenderOffersWithDetails,
  FiatLenderOfferStatus,
  FiatLoanStatus,
} from '@/hooks/useFiatLoan';
import { Search, Filter, Loader2, RefreshCw, FileText, TrendingUp, DollarSign } from 'lucide-react';

export type CryptoTab = 'requests' | 'offers';
export type FiatTab = 'requests' | 'offers';

interface CryptoTabButtonsProps {
  activeTab: CryptoTab;
  onTabChange: (tab: CryptoTab) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function CryptoTabButtons({
  activeTab,
  onTabChange,
  searchTerm,
  onSearchChange,
  isLoading,
  onRefresh,
}: CryptoTabButtonsProps) {
  // Get counts directly from contract
  const { data: nextRequestId } = useNextLoanRequestId();
  const { data: nextOfferId } = useNextLenderOfferId();

  const requestCount = nextRequestId ? Number(nextRequestId) : 0;
  const offerCount = nextOfferId ? Number(nextOfferId) : 0;

  // Fetch actual pending data to get accurate counts
  const { data: allRequests } = useBatchLoanRequests(0, Math.min(requestCount, 50));
  const { data: allOffers } = useBatchLenderOffers(0, Math.min(offerCount, 50));

  const counts = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return {
      requests: (allRequests || []).filter(r =>
        r.status === LoanRequestStatus.PENDING && r.expireAt > now
      ).length,
      offers: (allOffers || []).filter(o =>
        o.status === LoanRequestStatus.PENDING && o.expireAt > now
      ).length,
    };
  }, [allRequests, allOffers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
    >
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'requests' ? 'primary' : 'secondary'}
          onClick={() => onTabChange('requests')}
          icon={<FileText className="w-4 h-4" />}
        >
          Loan Requests ({counts.requests})
        </Button>
        <Button
          variant={activeTab === 'offers' ? 'primary' : 'secondary'}
          onClick={() => onTabChange('offers')}
          icon={<TrendingUp className="w-4 h-4" />}
        >
          Lender Offers ({counts.offers})
        </Button>
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input-field pl-10 w-full sm:w-64"
          />
        </div>
        <Button
          variant="secondary"
          icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          onClick={onRefresh}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button variant="secondary" icon={<Filter className="w-4 h-4" />}>
          Filter
        </Button>
      </div>
    </motion.div>
  );
}

interface FiatTabButtonsProps {
  activeTab: FiatTab;
  onTabChange: (tab: FiatTab) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function FiatTabButtons({
  activeTab,
  onTabChange,
  isLoading,
  onRefresh,
}: FiatTabButtonsProps) {
  // Get counts directly from contract hooks
  const { data: pendingFiatLoans } = usePendingFiatLoansWithDetails();
  const { data: fiatLenderOffers } = useActiveFiatLenderOffersWithDetails();

  const counts = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return {
      requests: (pendingFiatLoans || []).filter(l => {
        if (l.status !== FiatLoanStatus.PENDING_SUPPLIER) return false;
        // Calculate expiration (7 days from creation)
        const expiresAt = BigInt(Number(l.createdAt) + (7 * 24 * 60 * 60));
        return expiresAt > now;
      }).length,
      offers: (fiatLenderOffers || []).filter(o =>
        o.status === FiatLenderOfferStatus.ACTIVE && o.expireAt > now
      ).length,
    };
  }, [pendingFiatLoans, fiatLenderOffers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
    >
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'requests' ? 'primary' : 'secondary'}
          onClick={() => onTabChange('requests')}
          className={activeTab === 'requests' ? 'bg-green-600 hover:bg-green-700' : ''}
          icon={<DollarSign className="w-4 h-4" />}
        >
          Loan Requests ({counts.requests})
        </Button>
        <Button
          variant={activeTab === 'offers' ? 'primary' : 'secondary'}
          onClick={() => onTabChange('offers')}
          className={activeTab === 'offers' ? 'bg-green-600 hover:bg-green-700' : ''}
          icon={<TrendingUp className="w-4 h-4" />}
        >
          Lender Offers ({counts.offers})
        </Button>
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <Button
          variant="secondary"
          icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          onClick={onRefresh}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>
    </motion.div>
  );
}
