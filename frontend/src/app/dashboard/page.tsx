'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { TabButtons, Tab } from '@/components/dashboard/TabButtons';
import {
  BorrowedLoansTab,
  LentLoansTab,
  LoanRequestsTab,
  LenderOffersTab,
  FiatOffersTab,
  FiatRequestsTab,
} from '@/components/dashboard/DashboardTabs';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RepayLoanModal } from '@/components/loan/RepayLoanModal';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { SupplierSection } from '@/components/supplier/SupplierSection';
import { useDashboardDataLoader } from '@/hooks/useDashboardDataLoader';
import { Wallet, RefreshCw, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('borrowing');
  const { isLoading, refetch } = useDashboardDataLoader(address);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to view your dashboard and manage your loans.
          </p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex justify-between items-center"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Your <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-gray-400">
              Manage your loans, requests, and offers in one place.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            // icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </motion.div>

        <DashboardStats />

        {/* Supplier Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <SupplierSection />
        </motion.div>

        {/* Loading State */}
        {/* {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          </div>
        )} */}

        {/* {!isLoading && ( */}
          <>
            <TabButtons activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {activeTab === 'borrowing' && <BorrowedLoansTab />}
              {activeTab === 'lending' && <LentLoansTab />}
              {activeTab === 'requests' && <LoanRequestsTab />}
              {activeTab === 'offers' && <LenderOffersTab />}
              {activeTab === 'fiatOffers' && <FiatOffersTab />}
              {activeTab === 'fiatRequests' && <FiatRequestsTab />}
            </motion.div>
          </>
        {/* )} */}

        <QuickActions />
      </div>

      {/* Repay Modal - fully self-contained */}
      <RepayLoanModal />
    </div>
  );
}
