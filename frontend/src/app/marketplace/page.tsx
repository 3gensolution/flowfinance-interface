'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { useSupplierDetails } from '@/hooks/useSupplier';
import { useMarketplaceDataLoader } from '@/hooks/useMarketplaceDataLoader';
import {
  MarketTypeSelector,
  MarketType,
  CryptoMarketplaceStats,
  FiatMarketplaceStats,
  CryptoTabButtons,
  FiatTabButtons,
  CryptoTab,
  FiatTab,
  CryptoRequestsTab,
  CryptoOffersTab,
  FiatRequestsTab,
  FiatOffersTab,
  CryptoRequestsUserNotice,
  CryptoOffersUserNotice,
  FiatRequestsUserNotice,
  FiatOffersUserNotice,
  SupplierNotice,
  CryptoMarketplaceCTA,
  FiatMarketplaceCTA,
} from '@/components/marketplace';
import { Loader2 } from 'lucide-react';

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CryptoTab>('requests');
  const [fiatTab, setFiatTab] = useState<FiatTab>('requests');
  const [marketType, setMarketType] = useState<MarketType>('crypto');
  const [searchTerm, setSearchTerm] = useState('');
  const { address } = useAccount();

  // Supplier status for fiat loans
  const { isVerified: isSupplierVerified, isActive: isSupplierActive } = useSupplierDetails(address);
  const isVerifiedSupplier = isSupplierVerified && isSupplierActive;

  // Load marketplace data
  const { isLoadingCrypto, isLoadingFiat, refetch } = useMarketplaceDataLoader();

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'offers') {
      setActiveTab('offers');
    } else if (tab === 'requests') {
      setActiveTab('requests');
    }
  }, [searchParams]);

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

        {/* Market Type Selector */}
        <MarketTypeSelector
          marketType={marketType}
          onMarketTypeChange={setMarketType}
        />

        {/* Crypto Marketplace */}
        {marketType === 'crypto' && (
          <>
            <CryptoMarketplaceStats />

            <CryptoTabButtons
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              isLoading={isLoadingCrypto}
              onRefresh={refetch}
            />

            {/* User Notices */}
            {activeTab === 'requests' && <CryptoRequestsUserNotice />}
            {activeTab === 'offers' && <CryptoOffersUserNotice />}

            {/* Tab Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {activeTab === 'requests' && (
                <CryptoRequestsTab isLoading={isLoadingCrypto} />
              )}
              {activeTab === 'offers' && (
                <CryptoOffersTab isLoading={isLoadingCrypto} />
              )}
            </motion.div>

            <CryptoMarketplaceCTA />
          </>
        )}

        {/* Fiat Marketplace */}
        {marketType === 'fiat' && (
          <>
            <FiatMarketplaceStats />

            <FiatTabButtons
              activeTab={fiatTab}
              onTabChange={setFiatTab}
              isLoading={isLoadingFiat}
              onRefresh={refetch}
            />

            {/* User Notices */}
            {fiatTab === 'requests' && <FiatRequestsUserNotice />}
            {fiatTab === 'offers' && <FiatOffersUserNotice />}
            <SupplierNotice isVerifiedSupplier={isVerifiedSupplier} />

            {/* Tab Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {fiatTab === 'requests' && (
                <FiatRequestsTab
                  isLoading={isLoadingFiat}
                  isVerifiedSupplier={isVerifiedSupplier}
                  onRefresh={refetch}
                />
              )}
              {fiatTab === 'offers' && (
                <FiatOffersTab
                  isLoading={isLoadingFiat}
                  isVerifiedSupplier={isVerifiedSupplier}
                  onRefresh={refetch}
                />
              )}
            </motion.div>

            <FiatMarketplaceCTA
              activeTab={fiatTab}
              isVerifiedSupplier={isVerifiedSupplier}
            />
          </>
        )}
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
