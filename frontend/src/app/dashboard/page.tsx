'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, Address, parseUnits } from 'viem';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ActiveLoanCard, LoanRequestCard, LenderOfferCard } from '@/components/loan/LoanCard';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Modal } from '@/components/ui/Modal';
import { LoanStatus, LoanRequestStatus } from '@/types';
import {
  useUserDashboardData,
  useRepayLoan,
  useRepaymentAmount,
  useLoanHealthFactor,
  useApproveToken,
  useTokenAllowance,
  useCancelLoanRequest,
  useCancelLenderOffer,
} from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES, getTokenByAddress } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';
import {
  Wallet,
  TrendingUp,
  Shield,
  Clock,
  Plus,
  FileText,
  DollarSign,
  Activity,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

type Tab = 'borrowing' | 'lending' | 'requests' | 'offers';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('borrowing');
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<bigint | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  // Fetch user dashboard data from contracts
  const {
    borrowedLoans,
    lentLoans,
    loanRequests,
    lenderOffers,
    isLoading,
    refetch
  } = useUserDashboardData(address);

  // Contract write hooks
  const { repay, isPending: isRepayPending } = useRepayLoan();
  const { approve, isPending: isApproving } = useApproveToken();
  const { cancelRequest } = useCancelLoanRequest();
  const { cancelOffer } = useCancelLenderOffer();

  // Get selected loan details for repay modal
  const selectedLoan = useMemo(() => {
    if (!selectedLoanId) return null;
    return borrowedLoans.find(l => l.loanId === selectedLoanId) || null;
  }, [selectedLoanId, borrowedLoans]);

  // Get repayment amount for selected loan
  const { data: repaymentAmountData } = useRepaymentAmount(selectedLoanId || undefined);
  const totalRepaymentAmount = repaymentAmountData ? repaymentAmountData as bigint : BigInt(0);

  // Get token allowance for repay
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    selectedLoan?.borrowAsset,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Filter active loans
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

  // Calculate stats
  const stats = useMemo(() => {
    let totalBorrowedUSD = 0;
    let totalLentUSD = 0;
    let totalCollateralUSD = 0;

    activeBorrowedLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        // Approximate USD value (assume stablecoins are $1, others need price feed)
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI') {
          totalBorrowedUSD += amount;
        }
      }

      const collateralInfo = getTokenByAddress(loan.collateralAsset);
      if (collateralInfo) {
        const collateralAmount = Number(formatUnits(
          loan.collateralAmount - loan.collateralReleased,
          collateralInfo.decimals
        ));
        // Rough estimate for ETH at $2500
        if (collateralInfo.symbol === 'WETH') {
          totalCollateralUSD += collateralAmount * 2500;
        }
      }
    });

    activeLentLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      if (tokenInfo) {
        const amount = Number(formatUnits(loan.principalAmount, tokenInfo.decimals));
        if (tokenInfo.symbol === 'USDC' || tokenInfo.symbol === 'DAI') {
          totalLentUSD += amount;
        }
      }
    });

    return {
      totalBorrowed: totalBorrowedUSD,
      totalLent: totalLentUSD,
      totalCollateral: totalCollateralUSD,
      activeBorrowedCount: activeBorrowedLoans.length,
      activeLentCount: activeLentLoans.length,
      pendingRequestsCount: pendingRequests.length,
      pendingOffersCount: pendingOffers.length,
    };
  }, [activeBorrowedLoans, activeLentLoans, pendingRequests, pendingOffers]);

  // Handle repay loan
  const handleRepayClick = (loanId: bigint) => {
    setSelectedLoanId(loanId);
    setRepayAmount('');
    setRepayModalOpen(true);
  };

  const handleRepaySubmit = async () => {
    if (!selectedLoan || !repayAmount || !address) return;

    setIsRepaying(true);
    const toastId = toast.loading('Processing repayment...');

    try {
      const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
      if (!tokenInfo) throw new Error('Token not found');

      const repayAmountBigInt = parseUnits(repayAmount, tokenInfo.decimals);

      // Check if we need approval
      const currentAllowance = allowance as bigint || BigInt(0);
      if (currentAllowance < repayAmountBigInt) {
        toast.loading('Approving token...', { id: toastId });
        approve(
          selectedLoan.borrowAsset,
          CONTRACT_ADDRESSES.loanMarketPlace,
          repayAmountBigInt
        );
        // Wait a bit for approval to process
        await new Promise(resolve => setTimeout(resolve, 3000));
        await refetchAllowance();
      }

      // Simulate the repay transaction
      toast.loading('Simulating transaction...', { id: toastId });
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'repayLoan',
        args: [selectedLoan.loanId, repayAmountBigInt],
      });

      if (!simulation.success) {
        throw new Error(simulation.errorMessage || 'Simulation failed');
      }

      // Execute repay
      toast.loading('Confirming repayment...', { id: toastId });
      repay(selectedLoan.loanId, repayAmountBigInt);

      toast.success('Loan repaid successfully!', { id: toastId });
      setRepayModalOpen(false);
      setSelectedLoanId(null);
      refetch();
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsRepaying(false);
    }
  };

  const handleSetFullRepayment = () => {
    if (selectedLoan && totalRepaymentAmount > BigInt(0)) {
      const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
      if (tokenInfo) {
        setRepayAmount(formatUnits(totalRepaymentAmount, tokenInfo.decimals));
      }
    }
  };

  // Handle cancel request
  const handleCancelRequest = async (requestId: bigint) => {
    const toastId = toast.loading('Cancelling request...');
    try {
      cancelRequest(requestId);
      toast.success('Request cancellation submitted!', { id: toastId });
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    }
  };

  // Handle cancel offer
  const handleCancelOffer = async (offerId: bigint) => {
    const toastId = toast.loading('Cancelling offer...');
    try {
      cancelOffer(offerId);
      toast.success('Offer cancellation submitted!', { id: toastId });
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    }
  };

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
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
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
            value={`$${stats.totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            subValue={`${stats.activeBorrowedCount} active loan${stats.activeBorrowedCount !== 1 ? 's' : ''}`}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Total Lent"
            value={`$${stats.totalLent.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            subValue={`${stats.activeLentCount} active loan${stats.activeLentCount !== 1 ? 's' : ''}`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Collateral Locked"
            value={`$${stats.totalCollateral.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            subValue="In active loans"
            icon={<Shield className="w-5 h-5" />}
          />
          <StatCard
            label="Pending"
            value={`${stats.pendingRequestsCount + stats.pendingOffersCount}`}
            subValue={`${stats.pendingRequestsCount} requests, ${stats.pendingOffersCount} offers`}
            icon={<Activity className="w-5 h-5" />}
          />
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          </div>
        )}

        {!isLoading && (
          <>
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
                My Borrowed ({activeBorrowedLoans.length})
              </Button>
              <Button
                variant={activeTab === 'lending' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('lending')}
              >
                My Lent ({activeLentLoans.length})
              </Button>
              <Button
                variant={activeTab === 'requests' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('requests')}
              >
                My Requests ({pendingRequests.length})
              </Button>
              <Button
                variant={activeTab === 'offers' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('offers')}
              >
                My Offers ({pendingOffers.length})
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
                  {activeBorrowedLoans.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeBorrowedLoans.map((loan) => (
                        <ActiveLoanCardWithData
                          key={loan.loanId.toString()}
                          loan={loan}
                          isBorrower={true}
                          onRepay={() => handleRepayClick(loan.loanId)}
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
                  {activeLentLoans.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeLentLoans.map((loan) => (
                        <ActiveLoanCardWithData
                          key={loan.loanId.toString()}
                          loan={loan}
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
                  {pendingRequests.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingRequests.map((request) => (
                        <LoanRequestCard
                          key={request.requestId.toString()}
                          request={request}
                          isOwner={true}
                          onCancel={() => handleCancelRequest(request.requestId)}
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
                  {pendingOffers.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingOffers.map((offer) => (
                        <LenderOfferCard
                          key={offer.offerId.toString()}
                          offer={offer}
                          isOwner={true}
                          onCancel={() => handleCancelOffer(offer.offerId)}
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
          </>
        )}

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

      {/* Repay Modal */}
      <Modal
        isOpen={repayModalOpen}
        onClose={() => setRepayModalOpen(false)}
        title="Repay Loan"
      >
        {selectedLoan && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Loan ID</span>
                <span>#{selectedLoan.loanId.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Principal</span>
                <span>
                  {formatUnits(
                    selectedLoan.principalAmount,
                    getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
                  )} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Repayment (with interest)</span>
                <span className="text-primary-400 font-semibold">
                  {totalRepaymentAmount > BigInt(0)
                    ? formatUnits(
                        totalRepaymentAmount,
                        getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
                      )
                    : '...'
                  } {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Already Repaid</span>
                <span>
                  {formatUnits(
                    selectedLoan.amountRepaid,
                    getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
                  )} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Repayment Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="input-field flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetFullRepayment}
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the amount you want to repay. Full repayment will return all collateral.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setRepayModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRepaySubmit}
                disabled={!repayAmount || isRepaying || isRepayPending || isApproving}
                loading={isRepaying || isRepayPending || isApproving}
                className="flex-1"
              >
                {isApproving ? 'Approving...' : isRepaying || isRepayPending ? 'Repaying...' : 'Repay'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Wrapper component that fetches health factor and repayment amount for each loan
function ActiveLoanCardWithData({
  loan,
  isBorrower,
  onRepay,
}: {
  loan: {
    loanId: bigint;
    requestId: bigint;
    borrower: Address;
    lender: Address;
    collateralAsset: Address;
    collateralAmount: bigint;
    collateralReleased: bigint;
    borrowAsset: Address;
    principalAmount: bigint;
    interestRate: bigint;
    duration: bigint;
    startTime: bigint;
    dueDate: bigint;
    amountRepaid: bigint;
    status: number;
    lastInterestUpdate: bigint;
    gracePeriodEnd: bigint;
    isCrossChain: boolean;
    sourceChainId: bigint;
    targetChainId: bigint;
    remoteChainLoanId: bigint;
  };
  isBorrower: boolean;
  onRepay?: () => void;
}) {
  const { data: healthFactor } = useLoanHealthFactor(loan.loanId);
  const { data: repaymentAmount } = useRepaymentAmount(loan.loanId);

  // Convert the loan data to the expected Loan type
  const loanData = {
    ...loan,
    status: loan.status as LoanStatus,
  };

  return (
    <ActiveLoanCard
      loan={loanData}
      healthFactor={healthFactor ? healthFactor as bigint : BigInt(10000)}
      repaymentAmount={repaymentAmount ? repaymentAmount as bigint : undefined}
      isBorrower={isBorrower}
      onRepay={onRepay}
    />
  );
}
