'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoanRequestCard, LenderOfferCard } from '@/components/loan/LoanCard';
import {
  useNextLoanRequestId,
  useNextLenderOfferId,
  useBatchLoanRequests,
  useBatchLenderOffers
} from '@/hooks/useContracts';
import { LoanRequestStatus } from '@/types';
import { Search, Filter, TrendingUp, FileText, Loader2, RefreshCw, Clock } from 'lucide-react';
import Link from 'next/link';
import { getTokenDecimals } from '@/lib/utils';

type Tab = 'requests' | 'offers';

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const { address } = useAccount();

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'offers') {
      setActiveTab('offers');
    } else if (tab === 'requests') {
      setActiveTab('requests');
    }
  }, [searchParams]);

  // Get total counts
  const { data: nextRequestId, refetch: refetchRequestCount } = useNextLoanRequestId();
  const { data: nextOfferId, refetch: refetchOfferCount } = useNextLenderOfferId();

  // Calculate actual number of requests/offers (IDs start at 1, not 0)
  const requestCount = nextRequestId ? Number(nextRequestId) - 1 : 0;
  const offerCount = nextOfferId ? Number(nextOfferId) - 1 : 0;

  // Fetch loan requests using efficient multicall (start from ID 1, fetch up to 20)
  const {
    data: allRequests,
    isLoading: isLoadingRequests,
    refetch: refetchRequests
  } = useBatchLoanRequests(1, Math.min(requestCount, 20));

  // Fetch lender offers using efficient multicall (start from ID 1, fetch up to 20)
  const {
    data: allOffers,
    isLoading: isLoadingOffers,
    refetch: refetchOffers
  } = useBatchLenderOffers(1, Math.min(offerCount, 20));

  // Filter for PENDING status and exclude user's own requests
  const loanRequests = useMemo(() => {
    if (!allRequests) return [];
    return allRequests.filter((r) => {
      // Only show PENDING requests
      if (r.status !== LoanRequestStatus.PENDING) return false;
      // Hide user's own requests from them (they can't fund their own request)
      if (address && r.borrower.toLowerCase() === address.toLowerCase()) return false;
      return true;
    });
  }, [allRequests, address]);

  // Count user's own pending requests (hidden from marketplace)
  const userPendingRequests = useMemo(() => {
    if (!allRequests || !address) return 0;
    return allRequests.filter((r) =>
      r.status === LoanRequestStatus.PENDING &&
      r.borrower.toLowerCase() === address.toLowerCase()
    ).length;
  }, [allRequests, address]);

  // Filter for PENDING status and exclude user's own offers
  const lenderOffers = useMemo(() => {
    if (!allOffers) return [];
    return allOffers.filter((o) => {
      // Only show PENDING offers
      if (o.status !== LoanRequestStatus.PENDING) return false;
      // Hide user's own offers from them (they can't accept their own offer)
      if (address && o.lender.toLowerCase() === address.toLowerCase()) return false;
      return true;
    });
  }, [allOffers, address]);

  // Count user's own pending offers (hidden from marketplace)
  const userPendingOffers = useMemo(() => {
    if (!allOffers || !address) return 0;
    return allOffers.filter((o) =>
      o.status === LoanRequestStatus.PENDING &&
      o.lender.toLowerCase() === address.toLowerCase()
    ).length;
  }, [allOffers, address]);

  // Calculate real stats from the data
  const stats = useMemo(() => {
    const allPendingRequests = (allRequests || []).filter(r => r.status === LoanRequestStatus.PENDING);
    const allPendingOffers = (allOffers || []).filter(o => o.status === LoanRequestStatus.PENDING);

    // Calculate average interest rate from all pending items
    let totalInterestRate = BigInt(0);
    let itemCount = 0;

    allPendingRequests.forEach(r => {
      totalInterestRate += r.interestRate;
      itemCount++;
    });

    allPendingOffers.forEach(o => {
      totalInterestRate += o.interestRate;
      itemCount++;
    });

    const avgInterestRate = itemCount > 0
      ? (Number(totalInterestRate) / itemCount / 100).toFixed(1)
      : '0.0';

    // Calculate total volume (sum of all borrow amounts)
    let totalVolumeUsdc = 0;
    allPendingRequests.forEach(r => {
      const decimals = getTokenDecimals(r.borrowAsset);
      const amount = Number(r.borrowAmount) / Math.pow(10, decimals);
      totalVolumeUsdc += amount;
    });

    allPendingOffers.forEach(o => {
      const decimals = getTokenDecimals(o.lendAsset);
      const amount = Number(o.lendAmount) / Math.pow(10, decimals);
      totalVolumeUsdc += amount;
    });

    // Format volume for display
    const formattedVolume = totalVolumeUsdc >= 1000000
      ? `$${(totalVolumeUsdc / 1000000).toFixed(1)}M`
      : totalVolumeUsdc >= 1000
        ? `$${(totalVolumeUsdc / 1000).toFixed(1)}K`
        : `$${totalVolumeUsdc.toFixed(0)}`;

    return {
      activeRequests: allPendingRequests.length,
      activeOffers: allPendingOffers.length,
      avgInterestRate: `${avgInterestRate}%`,
      totalVolume: formattedVolume
    };
  }, [allRequests, allOffers]);

  const handleRefresh = () => {
    refetchRequestCount();
    refetchOfferCount();
    refetchRequests();
    refetchOffers();
  };

  const isLoading = isLoadingRequests || isLoadingOffers;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Loan <span className="gradient-text">Marketplace</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Browse active loan requests from borrowers or lender offers.
            Find the perfect match for your needs.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="text-center">
            <p className="text-gray-400 text-sm">Active Requests</p>
            <p className="text-2xl font-bold text-primary-400">
              {stats.activeRequests}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-gray-400 text-sm">Active Offers</p>
            <p className="text-2xl font-bold text-accent-400">
              {stats.activeOffers}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-gray-400 text-sm">Avg Interest Rate</p>
            <p className="text-2xl font-bold text-green-400">{stats.avgInterestRate}</p>
          </Card>
          <Card className="text-center">
            <p className="text-gray-400 text-sm">Total Volume</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.totalVolume}</p>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'requests' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('requests')}
              icon={<FileText className="w-4 h-4" />}
            >
              Loan Requests
            </Button>
            <Button
              variant={activeTab === 'offers' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('offers')}
              icon={<TrendingUp className="w-4 h-4" />}
            >
              Lender Offers
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-full sm:w-64"
              />
            </div>
            <Button
              variant="secondary"
              icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Button variant="secondary" icon={<Filter className="w-4 h-4" />}>
              Filter
            </Button>
          </div>
        </motion.div>

        {/* User's Own Pending Items Info */}
        {activeTab === 'requests' && userPendingRequests > 0 && (
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
        )}

        {activeTab === 'offers' && userPendingOffers > 0 && (
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
        )}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {activeTab === 'requests' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
              ) : loanRequests.length > 0 ? (
                loanRequests.map((request) => (
                  <LoanRequestCard
                    key={request.requestId.toString()}
                    request={request}
                    isOwner={false}
                  />
                ))
              ) : (
                <div className="col-span-full">
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
                </div>
              )}
            </div>
          )}

          {activeTab === 'offers' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
              ) : lenderOffers.length > 0 ? (
                lenderOffers.map((offer) => (
                  <LenderOfferCard
                    key={offer.offerId.toString()}
                    offer={offer}
                    isOwner={false}
                  />
                ))
              ) : (
                <div className="col-span-full">
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
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Card className="inline-block">
            <p className="text-gray-400 mb-4">
              Don&apos;t see what you&apos;re looking for?
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/borrow">
                <Button variant="secondary">Create Loan Request</Button>
              </Link>
              <Link href="/lend">
                <Button>Create Lender Offer</Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1920px] mx-auto flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
        </div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
