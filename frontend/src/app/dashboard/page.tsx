'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ActiveLoanCard, LoanRequestCard, LenderOfferCard } from '@/components/loan/LoanCard';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Loan, LoanRequest, LenderOffer, LoanStatus, LoanRequestStatus } from '@/types';
import {
  Wallet,
  TrendingUp,
  Shield,
  Clock,
  Plus,
  FileText,
  DollarSign,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'borrowing' | 'lending' | 'requests' | 'offers';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('borrowing');

  // Sample data for demo - in production, fetch from contract events/indexer
  const myBorrowedLoans: Loan[] = [
    {
      loanId: BigInt(0),
      requestId: BigInt(0),
      borrower: address as `0x${string}` || '0x0000000000000000000000000000000000000000',
      lender: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      collateralAsset: '0x4200000000000000000000000000000000000006' as `0x${string}`,
      collateralAmount: BigInt('1000000000000000000'),
      collateralReleased: BigInt(0),
      borrowAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
      principalAmount: BigInt('2000000000'),
      interestRate: BigInt(1000),
      duration: BigInt(2592000),
      startTime: BigInt(Math.floor(Date.now() / 1000) - 604800),
      dueDate: BigInt(Math.floor(Date.now() / 1000) + 1987200),
      amountRepaid: BigInt(0),
      status: LoanStatus.ACTIVE,
      lastInterestUpdate: BigInt(Math.floor(Date.now() / 1000)),
      gracePeriodEnd: BigInt(Math.floor(Date.now() / 1000) + 2592000),
      isCrossChain: false,
      sourceChainId: BigInt(0),
      targetChainId: BigInt(0),
      remoteChainLoanId: BigInt(0),
    },
  ];

  const myLentLoans: Loan[] = [];

  const myRequests: LoanRequest[] = [
    {
      requestId: BigInt(1),
      borrower: address as `0x${string}` || '0x0000000000000000000000000000000000000000',
      collateralAmount: BigInt('500000000000000000'),
      collateralToken: '0x4200000000000000000000000000000000000006' as `0x${string}`,
      borrowAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
      borrowAmount: BigInt('1000000000'),
      duration: BigInt(1209600),
      maxInterestRate: BigInt(800),
      interestRate: BigInt(800),
      createdAt: BigInt(Math.floor(Date.now() / 1000) - 43200),
      expireAt: BigInt(Math.floor(Date.now() / 1000) + 86400 * 29),
      status: LoanRequestStatus.PENDING,
    },
  ];

  const myOffers: LenderOffer[] = [];

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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Your <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-gray-400">
            Manage your loans, requests, and offers in one place.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            label="Total Borrowed"
            value="$2,000"
            subValue="1 active loan"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Total Lent"
            value="$0"
            subValue="0 active loans"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Collateral Locked"
            value="1.0 ETH"
            subValue="~$2,500 USD"
            icon={<Shield className="w-5 h-5" />}
          />
          <StatCard
            label="Pending Requests"
            value="1"
            subValue="Awaiting funding"
            icon={<Activity className="w-5 h-5" />}
          />
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-2 mb-6"
        >
          <Button
            variant={activeTab === 'borrowing' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('borrowing')}
          >
            My Borrowed ({myBorrowedLoans.length})
          </Button>
          <Button
            variant={activeTab === 'lending' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('lending')}
          >
            My Lent ({myLentLoans.length})
          </Button>
          <Button
            variant={activeTab === 'requests' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('requests')}
          >
            My Requests ({myRequests.length})
          </Button>
          <Button
            variant={activeTab === 'offers' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('offers')}
          >
            My Offers ({myOffers.length})
          </Button>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {activeTab === 'borrowing' && (
            <>
              {myBorrowedLoans.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myBorrowedLoans.map((loan) => (
                    <ActiveLoanCard
                      key={loan.loanId.toString()}
                      loan={loan}
                      healthFactor={BigInt(15000)}
                      repaymentAmount={BigInt('2050000000')}
                      isBorrower={true}
                      onRepay={() => console.log('Repay', loan.loanId)}
                    />
                  ))}
                </div>
              ) : (
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
              )}
            </>
          )}

          {activeTab === 'lending' && (
            <>
              {myLentLoans.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myLentLoans.map((loan) => (
                    <ActiveLoanCard
                      key={loan.loanId.toString()}
                      loan={loan}
                      healthFactor={BigInt(15000)}
                      isBorrower={false}
                    />
                  ))}
                </div>
              ) : (
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
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <>
              {myRequests.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myRequests.map((request) => (
                    <LoanRequestCard
                      key={request.requestId.toString()}
                      request={request}
                      isOwner={true}
                      onCancel={() => console.log('Cancel', request.requestId)}
                    />
                  ))}
                </div>
              ) : (
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
              )}
            </>
          )}

          {activeTab === 'offers' && (
            <>
              {myOffers.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myOffers.map((offer) => (
                    <LenderOfferCard
                      key={offer.offerId.toString()}
                      offer={offer}
                      isOwner={true}
                      onCancel={() => console.log('Cancel', offer.offerId)}
                    />
                  ))}
                </div>
              ) : (
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
              )}
            </>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/borrow">
              <Card hover className="text-center">
                <FileText className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                <h3 className="font-semibold">Create Loan Request</h3>
                <p className="text-sm text-gray-400">Borrow crypto</p>
              </Card>
            </Link>
            <Link href="/lend">
              <Card hover className="text-center">
                <TrendingUp className="w-8 h-8 text-accent-400 mx-auto mb-2" />
                <h3 className="font-semibold">Create Lender Offer</h3>
                <p className="text-sm text-gray-400">Earn interest</p>
              </Card>
            </Link>
            <Link href="/marketplace">
              <Card hover className="text-center">
                <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h3 className="font-semibold">Browse Marketplace</h3>
                <p className="text-sm text-gray-400">Find opportunities</p>
              </Card>
            </Link>
            <Card hover className="text-center opacity-50 cursor-not-allowed">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <h3 className="font-semibold">Transaction History</h3>
              <p className="text-sm text-gray-400">Coming soon</p>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
