'use client';

import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { RepayLoanModal } from '@/components/loan/RepayLoanModal';
import { useDashboardDataLoader } from '@/hooks/useDashboardDataLoader';
import {
  SummaryCards,
  FiatSupplierPanel,
  ActiveLoansOffers,
  PendingActionsAlert,
  ExpandedStatsAccordion,
  TransactionHistory,
} from '@/components/dashboard';
import { Wallet, RefreshCw, Loader2 } from 'lucide-react';
// import { isFiatSupportedOnActiveChain } from '@/config/contracts';
// import { useNetwork } from '@/contexts/NetworkContext';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { isLoading, refetch } = useDashboardDataLoader(address);
  // const { setSelectedNetwork } = useNetwork();
  // const { switchChain } = useSwitchChain();
  // const fiatSupported = isFiatSupportedOnActiveChain();

  // const handleSwitchToBase = () => {
  //   setSelectedNetwork(CHAIN_CONFIG.baseSepolia);
  //   switchChain({ chainId: CHAIN_CONFIG.baseSepolia.id });
  // };

  // Wallet not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to view your dashboard and manage your finances.
          </p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex justify-between items-center"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Your <span className="text-primary-400">Dashboard</span>
            </h1>
            <p className="text-gray-400">
              Manage your loans, track your balances, and view your transaction history.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </motion.div>

        {/* Section 1: Summary Cards */}
        <SummaryCards />

        {/* Section 2: Fiat Supplier Panel (Conditional) */}
        <FiatSupplierPanel />

        {/* Section 3: Active Loans & Offers */}
        <ActiveLoansOffers />

        {/* Section 4: Pending Actions */}
        <PendingActionsAlert />

        {/* Section 5: Expanded Stats (Accordion) */}
        <ExpandedStatsAccordion />

        {/* Section 6: Transaction History */}
        <TransactionHistory />
      </div>

      {/* Repay Modal - Global */}
      <RepayLoanModal />
    </div>
  );
}
