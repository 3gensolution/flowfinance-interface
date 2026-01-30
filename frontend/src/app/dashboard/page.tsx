'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ActiveLoanCard, LoanRequestCard, LenderOfferCard, FiatLenderOfferCard, FiatLoanRequestCard } from '@/components/loan/LoanCard';
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
  useTokenBalance,
  useCancelLoanRequest,
  useCancelLenderOffer,
  useTokenPrice,
  useRefreshMockPrice,
  useEscrowCollateralInfo,
} from '@/hooks/useContracts';
import {
  useUserFiatLenderOffers,
  useCancelFiatLenderOffer,
  useUserFiatLoansAsBorrower,
  useCancelFiatLoanRequest,
  FiatLenderOfferStatus,
  FiatLoanStatus,
} from '@/hooks/useFiatLoan';
import { CONTRACT_ADDRESSES, getTokenByAddress } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi, Address } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
import { SupplierSection } from '@/components/supplier/SupplierSection';
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
  AlertTriangle,
  Banknote,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type Tab = 'borrowing' | 'lending' | 'requests' | 'offers' | 'fiatOffers' | 'fiatRequests';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [activeTab, setActiveTab] = useState<Tab>('borrowing');
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<bigint | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [repayStep, setRepayStep] = useState<'input' | 'approve' | 'repay'>('input');
  const hasInitializedRepayAmount = useRef(false);

  // Fetch user dashboard data from contracts
  const {
    borrowedLoans,
    lentLoans,
    loanRequests,
    lenderOffers,
    isLoading,
    refetch
  } = useUserDashboardData(address);

  // Fetch user's fiat lender offers
  const {
    data: fiatLenderOffers,
    isLoading: isLoadingFiatOffers,
    refetch: refetchFiatOffers,
  } = useUserFiatLenderOffers(address);

  // Fetch user's fiat loan requests (as borrower)
  const {
    data: fiatLoanRequests,
    isLoading: isLoadingFiatRequests,
    refetch: refetchFiatRequests,
  } = useUserFiatLoansAsBorrower(address);

  // Contract write hooks
  const { repayAsync, isPending: isRepayPending } = useRepayLoan();
  const { approveAsync } = useApproveToken();
  const { cancelRequest } = useCancelLoanRequest();
  const { cancelOffer } = useCancelLenderOffer();
  const { cancelFiatLenderOffer } = useCancelFiatLenderOffer();
  const { cancelFiatLoanRequest } = useCancelFiatLoanRequest();

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

  // Get user's token balance for the borrow asset
  const { data: userTokenBalance } = useTokenBalance(
    selectedLoan?.borrowAsset,
    address
  );

  // Get price data for the borrow asset to check staleness
  const borrowAssetPrice = useTokenPrice(selectedLoan?.borrowAsset as Address | undefined);
  const isPriceStale = borrowAssetPrice.isStale;
  const priceFeedAddress = borrowAssetPrice.priceFeedAddress as Address | undefined;
  const currentPrice = borrowAssetPrice.price;

  // Get escrow collateral info for debugging
  const { data: escrowInfo } = useEscrowCollateralInfo(selectedLoanId || undefined);
  const escrowCollateralAmount = escrowInfo ? (escrowInfo as readonly [Address, bigint, Address])[1] : BigInt(0);

  // Hook to refresh mock price feed
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // State for simulation error
  const [simulationError, setSimulationError] = useState<string>('');

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

  const pendingFiatOffers = useMemo(() =>
    fiatLenderOffers.filter(o => o.status === FiatLenderOfferStatus.ACTIVE),
    [fiatLenderOffers]
  );

  const pendingFiatRequests = useMemo(() =>
    fiatLoanRequests.filter(r => r.status === FiatLoanStatus.PENDING_SUPPLIER),
    [fiatLoanRequests]
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
      pendingFiatOffersCount: pendingFiatOffers.length,
      pendingFiatRequestsCount: pendingFiatRequests.length,
    };
  }, [activeBorrowedLoans, activeLentLoans, pendingRequests, pendingOffers, pendingFiatOffers, pendingFiatRequests]);

  // Track which loan the approval was for
  const [approvedForLoanId, setApprovedForLoanId] = useState<bigint | null>(null);

  // Handle repay loan
  const handleRepayClick = async (loanId: bigint) => {
    setSelectedLoanId(loanId);
    setRepayStep('input');
    setSimulationError('');
    // Reset approval tracking if switching to a different loan
    if (approvedForLoanId !== loanId) {
      setApprovedForLoanId(null);
    }
    setRepayModalOpen(true);
    // Refetch allowance to ensure we have fresh data for this loan
    setTimeout(() => refetchAllowance(), 100);
  };

  // Check if approval is needed and determine the repay amount
  const getRepayAmountBigInt = () => {
    if (!selectedLoan || !repayAmount) return BigInt(0);
    const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
    if (!tokenInfo) return BigInt(0);
    try {
      return parseUnits(repayAmount, tokenInfo.decimals);
    } catch {
      return BigInt(0);
    }
  };

  const repayAmountBigInt = getRepayAmountBigInt();
  const userBalance = (userTokenBalance as bigint) || BigInt(0);

  // Check if user has any balance
  const hasBalance = userBalance > BigInt(0);

  // Calculate remaining amount to repay (total repayment - already paid)
  const amountAlreadyRepaid = selectedLoan?.amountRepaid || BigInt(0);
  const remainingToRepay = totalRepaymentAmount > amountAlreadyRepaid
    ? totalRepaymentAmount - amountAlreadyRepaid
    : BigInt(0);

  // Get token info for display
  const selectedTokenInfo = selectedLoan ? getTokenByAddress(selectedLoan.borrowAsset) : null;
  const formattedUserBalance = selectedTokenInfo && userBalance > BigInt(0)
    ? formatUnits(userBalance, selectedTokenInfo.decimals)
    : '0';
  const formattedRemainingToRepay = selectedTokenInfo && remainingToRepay > BigInt(0)
    ? formatUnits(remainingToRepay, selectedTokenInfo.decimals)
    : '0';

  // Auto-set repay amount to remaining when modal FIRST opens (only once)
  useEffect(() => {
    if (repayModalOpen && selectedLoan && remainingToRepay > BigInt(0) && selectedTokenInfo && !hasInitializedRepayAmount.current) {
      const formattedAmount = formatUnits(remainingToRepay, selectedTokenInfo.decimals);
      setRepayAmount(formattedAmount);
      hasInitializedRepayAmount.current = true;
    }
    // Reset the flag when modal closes
    if (!repayModalOpen) {
      hasInitializedRepayAmount.current = false;
    }
  }, [repayModalOpen, selectedLoan, remainingToRepay, selectedTokenInfo]);

  // Handle proceeding from input step
  const handleProceedToApproveOrRepay = async () => {
    // Don't proceed if no balance
    if (!hasBalance) {
      toast.error(`You don't have any ${selectedTokenInfo?.symbol || 'tokens'} to repay with.`);
      return;
    }

    // Don't proceed if amount is 0
    if (repayAmountBigInt === BigInt(0)) {
      toast.error('Please enter an amount to repay.');
      return;
    }

    // Refetch allowance to get the latest value
    const { data: latestAllowance } = await refetchAllowance();
    const currentAllowanceValue = (latestAllowance as bigint) || BigInt(0);

    // Check if current allowance is sufficient for the repay amount
    if (currentAllowanceValue < repayAmountBigInt) {
      setRepayStep('approve');
    } else {
      setRepayStep('repay');
    }
  };

  // Handle approval step
  const handleApprove = async () => {
    if (!selectedLoan || !repayAmount || !address || !publicClient) return;

    setIsApprovingToken(true);
    const toastId = toast.loading('Approving token...');

    try {
      const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
      if (!tokenInfo) throw new Error('Token not found');

      const baseAmount = parseUnits(repayAmount, tokenInfo.decimals);
      // Add 1% buffer to account for interest accrual between approval and repayment
      const amountToApprove = baseAmount + (baseAmount / BigInt(100));

      // Send approval transaction and get the hash
      const approvalHash = await approveAsync(
        selectedLoan.borrowAsset,
        CONTRACT_ADDRESSES.loanMarketPlace,
        amountToApprove
      );

      // Wait for approval transaction to be confirmed
      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });

      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        toast.error('Approval transaction failed. Please try again.', { id: toastId });
        setIsApprovingToken(false);
        return;
      }

      // Refetch allowance and wait for it to update
      toast.loading('Verifying allowance...', { id: toastId });
      const { data: newAllowance } = await refetchAllowance();

      // Verify the allowance is now sufficient
      const updatedAllowance = (newAllowance as bigint) || BigInt(0);
      if (updatedAllowance < amountToApprove) {
        // Sometimes the RPC might be slow - wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: retryAllowance } = await refetchAllowance();
        const finalAllowance = (retryAllowance as bigint) || BigInt(0);

        if (finalAllowance < amountToApprove) {
          toast.error('Allowance not updated. Please try again.', { id: toastId });
          setIsApprovingToken(false);
          return;
        }
      }

      toast.success('Token approved! You can now repay.', { id: toastId });

      // Track which loan this approval was for
      setApprovedForLoanId(selectedLoanId);

      // Move to repay step only after confirmed
      setRepayStep('repay');
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsApprovingToken(false);
    }
  };

  // Check if this is a partial repayment (requires price check)
  const isPartialRepayment = totalRepaymentAmount > BigInt(0) && repayAmountBigInt > BigInt(0) && repayAmountBigInt < totalRepaymentAmount;

  // Handle refreshing the price feed
  const handleRefreshPrice = async () => {
    if (!priceFeedAddress || !currentPrice || !selectedLoan?.borrowAsset) {
      toast.error('Price feed not available');
      return;
    }

    const toastId = toast.loading('Refreshing price feed...');
    try {
      const hash = await refreshPrice(priceFeedAddress, currentPrice, selectedLoan.borrowAsset);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      // Refetch the price data
      await borrowAssetPrice.refetch();
      toast.success('Price feed refreshed!', { id: toastId });
      setSimulationError('');
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(`Failed to refresh price: ${errorMsg}`, { id: toastId });
    }
  };

  // Handle repay step
  const handleRepaySubmit = async () => {
    if (!selectedLoan || !repayAmount || !address || !publicClient) return;

    // Double-check allowance before repaying
    const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
    if (!tokenInfo) return;

    const amountToRepay = parseUnits(repayAmount, tokenInfo.decimals);
    const latestAllowance = (allowance as bigint) || BigInt(0);

    // Debug logging
    console.log('Repay Debug:', {
      loanId: selectedLoan.loanId.toString(),
      borrowAsset: selectedLoan.borrowAsset,
      amountToRepay: amountToRepay.toString(),
      amountToRepayFormatted: repayAmount,
      totalRepaymentAmount: totalRepaymentAmount.toString(),
      remainingToRepay: remainingToRepay.toString(),
      allowance: latestAllowance.toString(),
      userBalance: userBalance.toString(),
      isPriceStale,
      isPartialRepayment,
    });

    if (latestAllowance < amountToRepay) {
      toast.error('Insufficient allowance. Please approve first.');
      setRepayStep('approve');
      return;
    }

    setIsRepaying(true);
    setSimulationError('');
    const toastId = toast.loading('Simulating transaction...');

    try {
      // Simulate the repay transaction first to catch errors before spending gas
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'repayLoan',
        args: [selectedLoan.loanId, amountToRepay],
        account: address,
      });

      if (!simulation.success) {
        // Get the most detailed error message possible
        let errorMsg = simulation.errorMessage || 'Transaction simulation failed';

        // If we have the raw error, try to extract more details
        if (simulation.error) {
          const rawError = simulation.error;
          // Check for revert reason in the error
          if (rawError.message && rawError.message.includes('revert')) {
            const revertMatch = rawError.message.match(/revert[:\s]*(.*?)(?:\n|$)/i);
            if (revertMatch && revertMatch[1]) {
              errorMsg = revertMatch[1].trim();
            }
          }
          // Check shortMessage for more context
          if (rawError.shortMessage && rawError.shortMessage !== errorMsg) {
            errorMsg = rawError.shortMessage;
          }
          // Log full error for debugging
          console.error('Simulation error details:', {
            message: rawError.message,
            shortMessage: rawError.shortMessage,
            cause: rawError.cause,
            data: rawError.data,
          });
        }

        setSimulationError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        setIsRepaying(false);
        return;
      }

      // Simulation passed, now execute the actual transaction
      toast.loading('Repaying loan...', { id: toastId });
      const repayHash = await repayAsync(selectedLoan.loanId, amountToRepay);

      // Wait for repay transaction to be confirmed
      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: repayHash });

      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        toast.error('Transaction reverted. Please try again.', { id: toastId });
        return;
      }

      toast.success('Loan repaid successfully!', { id: toastId });
      setRepayModalOpen(false);
      setSelectedLoanId(null);
      setRepayStep('input');
      setSimulationError('');
      setApprovedForLoanId(null);
      refetch();
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsRepaying(false);
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

  // Handle cancel fiat offer
  const handleCancelFiatOffer = async (offerId: bigint) => {
    const toastId = toast.loading('Cancelling fiat offer...');
    try {
      await cancelFiatLenderOffer(offerId);
      toast.success('Fiat offer cancellation submitted!', { id: toastId });
      setTimeout(() => refetchFiatOffers(), 2000);
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    }
  };

  // Handle cancel fiat request
  const handleCancelFiatRequest = async (loanId: bigint) => {
    const toastId = toast.loading('Cancelling fiat loan request...');
    try {
      await cancelFiatLoanRequest(loanId);
      toast.success('Fiat loan request cancellation submitted!', { id: toastId });
      setTimeout(() => refetchFiatRequests(), 2000);
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
            value={`${stats.pendingRequestsCount + stats.pendingOffersCount + stats.pendingFiatOffersCount + stats.pendingFiatRequestsCount}`}
            subValue={`${stats.pendingRequestsCount} crypto, ${stats.pendingFiatRequestsCount} fiat req, ${stats.pendingFiatOffersCount} fiat offers`}
            icon={<Activity className="w-5 h-5" />}
          />
        </motion.div>

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
              <Button
                variant={activeTab === 'fiatOffers' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('fiatOffers')}
                className={activeTab === 'fiatOffers' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <Banknote className="w-4 h-4 mr-1" />
                Fiat Offers ({pendingFiatOffers.length})
              </Button>
              <Button
                variant={activeTab === 'fiatRequests' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('fiatRequests')}
                className={activeTab === 'fiatRequests' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Fiat Requests ({pendingFiatRequests.length})
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

              {activeTab === 'fiatOffers' && (
                <>
                  {isLoadingFiatOffers ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                    </div>
                  ) : pendingFiatOffers.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingFiatOffers.map((offer) => (
                        <FiatLenderOfferCard
                          key={offer.offerId.toString()}
                          offer={offer}
                          isOwner={true}
                          onCancel={() => handleCancelFiatOffer(offer.offerId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card className="text-center py-12 border-green-500/20">
                      <Banknote className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No Active Fiat Offers</h3>
                      <p className="text-gray-400 mb-4">
                        You don&apos;t have any active fiat lender offers.
                      </p>
                      <Link href="/lend">
                        <Button className="bg-green-600 hover:bg-green-700" icon={<Plus className="w-4 h-4" />}>
                          Create Fiat Offer
                        </Button>
                      </Link>
                    </Card>
                  )}
                </>
              )}

              {activeTab === 'fiatRequests' && (
                <>
                  {isLoadingFiatRequests ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                    </div>
                  ) : pendingFiatRequests.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingFiatRequests.map((loan) => (
                        <FiatLoanRequestCard
                          key={loan.loanId.toString()}
                          loan={loan}
                          isOwner={true}
                          onCancel={() => handleCancelFiatRequest(loan.loanId)}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card className="text-center py-12 border-green-500/20">
                      <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No Pending Fiat Requests</h3>
                      <p className="text-gray-400 mb-4">
                        You don&apos;t have any pending fiat loan requests.
                      </p>
                      <Link href="/borrow">
                        <Button className="bg-green-600 hover:bg-green-700" icon={<Plus className="w-4 h-4" />}>
                          Create Fiat Loan Request
                        </Button>
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
        onClose={() => {
          setRepayModalOpen(false);
          setRepayStep('input');
          setSimulationError('');
        }}
        title="Repay Loan"
      >
        {selectedLoan && (
          <div className="space-y-4">
            {/* Loan Info */}
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
              <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                <span className="text-gray-400 font-medium">Remaining to Repay</span>
                <span className="text-primary-400 font-bold">
                  {formattedRemainingToRepay} {selectedTokenInfo?.symbol}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-400">Your Balance</span>
                <span className={`font-semibold ${hasBalance ? 'text-green-400' : 'text-red-400'}`}>
                  {formattedUserBalance} {selectedTokenInfo?.symbol}
                </span>
              </div>
              {userBalance < remainingToRepay && hasBalance && (
                <p className="text-xs text-yellow-500 mt-1">
                  Your balance is less than the remaining amount. You can make a partial repayment.
                </p>
              )}
            </div>

            {/* Debug: Escrow Collateral Info */}
            <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 text-xs">
              <p className="text-gray-500 font-medium mb-2">Debug: Escrow Info</p>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan collateralAmount:</span>
                  <span className="text-gray-300">
                    {formatUnits(selectedLoan.collateralAmount, getTokenByAddress(selectedLoan.collateralAsset)?.decimals || 18)} {getTokenByAddress(selectedLoan.collateralAsset)?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan collateralReleased:</span>
                  <span className="text-gray-300">
                    {formatUnits(selectedLoan.collateralReleased, getTokenByAddress(selectedLoan.collateralAsset)?.decimals || 18)} {getTokenByAddress(selectedLoan.collateralAsset)?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan available (calc):</span>
                  <span className="text-gray-300">
                    {formatUnits(selectedLoan.collateralAmount - selectedLoan.collateralReleased, getTokenByAddress(selectedLoan.collateralAsset)?.decimals || 18)} {getTokenByAddress(selectedLoan.collateralAsset)?.symbol}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                  <span className="text-gray-500">Escrow actual balance:</span>
                  <span className={escrowCollateralAmount >= (selectedLoan.collateralAmount - selectedLoan.collateralReleased) ? 'text-green-400' : 'text-red-400'}>
                    {formatUnits(escrowCollateralAmount, getTokenByAddress(selectedLoan.collateralAsset)?.decimals || 18)} {getTokenByAddress(selectedLoan.collateralAsset)?.symbol}
                  </span>
                </div>
                {escrowCollateralAmount < (selectedLoan.collateralAmount - selectedLoan.collateralReleased) && (
                  <p className="text-red-400 mt-2">
                    ⚠️ MISMATCH: Escrow has less collateral than expected. This will cause repay to fail.
                  </p>
                )}
              </div>
            </div>

            {/* Step Indicator */}
            {repayStep !== 'input' && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  repayStep === 'approve' ? 'bg-primary-500 text-white' : 'bg-green-500 text-white'
                }`}>
                  1
                </div>
                <div className={`w-12 h-1 ${repayStep === 'repay' ? 'bg-green-500' : 'bg-gray-600'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  repayStep === 'repay' ? 'bg-primary-500 text-white' : 'bg-gray-600 text-gray-400'
                }`}>
                  2
                </div>
              </div>
            )}

            {/* Step: Input Amount */}
            {repayStep === 'input' && (
              <>
                {/* Calculated Amount from Contract */}
                <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Total Amount Due (from contract)</p>
                  <p className="text-2xl font-bold text-primary-400">
                    {formattedRemainingToRepay} {selectedTokenInfo?.symbol}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Principal + accrued interest. You can pay partially or in full.
                  </p>
                </div>

                {/* No balance warning with faucet link */}
                {!hasBalance && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm mb-2">
                      You don&apos;t have any {selectedTokenInfo?.symbol || 'tokens'} to repay with.
                    </p>
                    <Link
                      href="/faucet"
                      className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 underline"
                      onClick={() => setRepayModalOpen(false)}
                    >
                      Get testnet tokens from Faucet →
                    </Link>
                  </div>
                )}

                {/* Input field for repayment amount */}
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
                      disabled={!hasBalance}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRepayAmount(formattedRemainingToRepay)}
                      disabled={!hasBalance || remainingToRepay === BigInt(0)}
                    >
                      Max
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your balance: {formattedUserBalance} {selectedTokenInfo?.symbol}
                    {hasBalance && userBalance < remainingToRepay && (
                      <span className="text-yellow-400 ml-2">(partial repayment possible)</span>
                    )}
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
                    onClick={handleProceedToApproveOrRepay}
                    disabled={!hasBalance || !repayAmount || repayAmountBigInt === BigInt(0)}
                    className="flex-1"
                  >
                    {!hasBalance ? 'No Balance' : 'Continue'}
                  </Button>
                </div>
              </>
            )}

            {/* Step: Approve Token */}
            {repayStep === 'approve' && (
              <>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 font-medium mb-1">Approval Required</p>
                  <p className="text-sm text-gray-400">
                    You need to approve the contract to spend {repayAmount} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol} before you can repay.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setRepayStep('input')}
                    className="flex-1"
                    disabled={isApprovingToken}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isApprovingToken}
                    loading={isApprovingToken}
                    className="flex-1"
                  >
                    {isApprovingToken ? 'Approving...' : 'Approve'}
                  </Button>
                </div>
              </>
            )}

            {/* Step: Repay */}
            {repayStep === 'repay' && (
              <>
                {/* Price Stale Warning for partial repayments */}
                {isPriceStale && isPartialRepayment && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-400 font-medium mb-1">Price Data is Stale</p>
                        <p className="text-sm text-gray-400 mb-3">
                          The price feed data is older than 15 minutes. Partial repayments require fresh price data.
                          Please refresh the price feed before repaying.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleRefreshPrice}
                          disabled={isRefreshingPrice}
                          loading={isRefreshingPrice}
                          className="w-full"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                          {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feed'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Simulation Error Display */}
                {simulationError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium mb-1">Transaction Will Fail</p>
                        <p className="text-sm text-gray-400">{simulationError}</p>
                        {simulationError.toLowerCase().includes('stale') && priceFeedAddress && currentPrice && (
                          <Button
                            size="sm"
                            onClick={handleRefreshPrice}
                            disabled={isRefreshingPrice}
                            loading={isRefreshingPrice}
                            className="mt-3 w-full"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                            {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feed'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ready to repay message (only show if no errors) */}
                {!isPriceStale && !simulationError && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 font-medium mb-1">Ready to Repay</p>
                    <p className="text-sm text-gray-400">
                      You are about to repay {repayAmount} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol} to your loan.
                      {!isPartialRepayment && ' This is a full repayment - all collateral will be returned.'}
                    </p>
                  </div>
                )}

                {/* Ready but with stale price warning for full repayment */}
                {isPriceStale && !isPartialRepayment && !simulationError && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 font-medium mb-1">Ready to Repay</p>
                    <p className="text-sm text-gray-400">
                      You are about to fully repay {repayAmount} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}.
                      Full repayments do not require price data.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRepayStep('input');
                      setSimulationError('');
                    }}
                    className="flex-1"
                    disabled={isRepaying}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleRepaySubmit}
                    disabled={isRepaying || isRepayPending || (isPriceStale && isPartialRepayment)}
                    loading={isRepaying || isRepayPending}
                    className="flex-1"
                  >
                    {isRepaying || isRepayPending ? 'Repaying...' : 'Confirm Repay'}
                  </Button>
                </div>
              </>
            )}
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
  const { data: healthFactor, isLoading: isLoadingHealth } = useLoanHealthFactor(loan.loanId);
  const { data: repaymentAmount } = useRepaymentAmount(loan.loanId);

  // Convert the loan data to the expected Loan type
  const loanData = {
    ...loan,
    status: loan.status as LoanStatus,
  };

  // Only pass health factor if actually loaded from blockchain
  const healthFactorValue = healthFactor ? healthFactor as bigint : undefined;

  return (
    <ActiveLoanCard
      loan={loanData}
      healthFactor={healthFactorValue}
      isLoadingHealth={isLoadingHealth}
      repaymentAmount={repaymentAmount ? repaymentAmount as bigint : undefined}
      isBorrower={isBorrower}
      onRepay={onRepay}
    />
  );
}
