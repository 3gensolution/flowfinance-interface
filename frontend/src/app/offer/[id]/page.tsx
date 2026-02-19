'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useLenderOffer,
  useAcceptLenderOffer,
  useTokenPrice,
  useApproveToken,
  useTokenBalance,
  useTokenAllowance,
  useLTV,
  useRefreshMockPrice,
} from '@/hooks/useContracts';
import { LoanRequestStatus } from '@/types';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
  formatTimeUntil,
  getTokenSymbol,
  getTokenDecimals,
} from '@/lib/utils';
import { TOKEN_LIST } from '@/config/contracts';
import { Address } from 'viem';
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  Clock,
  User,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Wallet,
  Info,
  AlertCircle,
  RefreshCw,
  Percent,
  Timer,
  Coins,
  Calendar,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN, CONTRACT_ADDRESSES } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

// Status config
const STATUS_CONFIG: Record<number, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  [LoanRequestStatus.PENDING]: {
    label: 'Pending',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-yellow-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  [LoanRequestStatus.FUNDED]: {
    label: 'Funded',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  [LoanRequestStatus.EXPIRED]: {
    label: 'Expired',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    borderColor: 'border-gray-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  [LoanRequestStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptStep, setAcceptStep] = useState<'approve' | 'accept'>('approve');
  const [simulationError, setSimulationError] = useState<string>('');

  // State for flexible collateral (when offer accepts any collateral)
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<Address | ''>('');

  // State for partial borrowing - how much user wants to borrow (up to remaining amount)
  const [borrowAmountInput, setBorrowAmountInput] = useState<string>('');

  // Fetch lender offer data
  const { data: offerData, isLoading: offerLoading, refetch } = useLenderOffer(offerId);

  // Parse offer data from contract (it returns a tuple)
  const offerTuple = offerData as readonly unknown[];
  const offer = offerData ? {
    offerId: offerTuple[0] as bigint,
    lender: offerTuple[1] as `0x${string}`,
    lendAsset: offerTuple[2] as `0x${string}`,
    lendAmount: offerTuple[3] as bigint,
    remainingAmount: offerTuple[4] as bigint,
    borrowedAmount: offerTuple[5] as bigint,
    requiredCollateralAsset: offerTuple[6] as `0x${string}`,
    minCollateralAmount: offerTuple[7] as bigint,
    duration: offerTuple[8] as bigint,
    interestRate: offerTuple[9] as bigint,
    createdAt: offerTuple[10] as bigint,
    expireAt: offerTuple[11] as bigint,
    status: offerTuple[12] as LoanRequestStatus,
    chainId: offerTuple[13] as bigint,
  } : null;

  // Get the remaining amount available to borrow
  const remainingAmount = offer?.remainingAmount || BigInt(0);

  // Token info
  const lendSymbol = offer ? getTokenSymbol(offer.lendAsset) : '';
  const lendDecimals = offer ? Number(getTokenDecimals(offer.lendAsset)) : 18;

  // Parse borrow amount input (after lendDecimals is defined)
  const parsedBorrowAmount = borrowAmountInput
    ? parseUnits(borrowAmountInput, lendDecimals)
    : remainingAmount;

  // Initialize borrow amount when offer loads
  useEffect(() => {
    if (offer && remainingAmount > BigInt(0) && !borrowAmountInput) {
      setBorrowAmountInput(formatUnits(remainingAmount, lendDecimals));
    }
  }, [offer, remainingAmount, lendDecimals, borrowAmountInput]);

  // Validate borrow amount
  const isBorrowAmountValid = parsedBorrowAmount > BigInt(0) && parsedBorrowAmount <= remainingAmount;

  // Borrower always picks collateral dynamically
  const activeCollateralToken = selectedCollateralToken
    ? (selectedCollateralToken as Address)
    : undefined;
  const collateralSymbol = selectedCollateralToken
    ? getTokenSymbol(selectedCollateralToken as Address)
    : 'Select Token';
  const collateralDecimals = selectedCollateralToken
    ? Number(getTokenDecimals(selectedCollateralToken as Address))
    : 18;

  // Check if user is the lender (owner of the offer)
  const isLender = offer && address?.toLowerCase() === offer.lender.toLowerCase();

  // Get borrower's collateral balance and allowance
  const { data: borrowerCollateralBalance } = useTokenBalance(activeCollateralToken, address);
  const { data: borrowerCollateralAllowance, refetch: refetchAllowance } = useTokenAllowance(
    activeCollateralToken,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Price data for USD values
  const lendPriceHook = useTokenPrice(offer?.lendAsset);
  const collateralPriceHook = useTokenPrice(activeCollateralToken);
  const lendPrice = lendPriceHook.price;
  const collateralPrice = collateralPriceHook.price;

  // Price refresh hook
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // Check price staleness
  const isPriceStale = lendPriceHook.isStale || (selectedCollateralToken && collateralPriceHook.isStale);

  // Handle price refresh
  const handleRefreshPrices = async () => {
    try {
      if (lendPriceHook.isStale && lendPriceHook.priceFeedAddress && lendPrice) {
        await refreshPrice(lendPriceHook.priceFeedAddress as Address, BigInt(lendPrice), offer?.lendAsset);
      }
      if (collateralPriceHook.isStale && collateralPriceHook.priceFeedAddress && collateralPrice && activeCollateralToken) {
        await refreshPrice(collateralPriceHook.priceFeedAddress as Address, BigInt(collateralPrice), activeCollateralToken);
      }
      toast.success('Price feeds refreshed!');
      lendPriceHook.refetch();
      collateralPriceHook.refetch();
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      toast.error('Failed to refresh price feeds');
    }
  };

  // Calculate USD values
  const lendUSD = offer && lendPrice
    ? (Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals))) * Number(lendPrice) / 1e8
    : 0;

  // Get LTV from contract
  const durationDays = offer ? Math.ceil(Number(offer.duration) / (24 * 60 * 60)) : 0;
  const { data: ltvBps } = useLTV(activeCollateralToken, durationDays);
  const currentLTV = ltvBps ? Number(ltvBps) / 100 : 0;

  // Calculate required collateral from contract LTV and prices
  const calculatedCollateralAmount = (() => {
    const ltvValue = ltvBps ? Number(ltvBps) : 0;
    if (!offer || !lendPrice || !collateralPrice || ltvValue === 0 || parsedBorrowAmount === BigInt(0)) {
      return BigInt(0);
    }
    const borrowAmountBN = parsedBorrowAmount;
    const lendPriceBN = BigInt(lendPrice);
    const collateralPriceBN = BigInt(collateralPrice);
    const ltvBpsBN = BigInt(ltvValue);
    const numerator = borrowAmountBN * lendPriceBN * BigInt(10000) * BigInt(10 ** collateralDecimals);
    const denominator = ltvBpsBN * collateralPriceBN * BigInt(10 ** lendDecimals);
    if (denominator === BigInt(0)) return BigInt(0);
    return numerator / denominator;
  })();

  const collateralAmountBigInt = calculatedCollateralAmount;

  const minCollateralUSD = collateralPrice && collateralAmountBigInt
    ? (Number(collateralAmountBigInt) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  const requiredCollateralFormatted = collateralAmountBigInt > BigInt(0)
    ? formatTokenAmount(collateralAmountBigInt, collateralDecimals)
    : '0';

  // Balance calculations
  const maxCollateralBalance = borrowerCollateralBalance
    ? formatUnits(borrowerCollateralBalance as bigint, collateralDecimals)
    : '0';
  const maxCollateralBalanceNumber = parseFloat(maxCollateralBalance);

  const hasZeroBalance = maxCollateralBalanceNumber === 0;
  const hasInsufficientBalance = borrowerCollateralBalance && collateralAmountBigInt
    ? (borrowerCollateralBalance as bigint) < collateralAmountBigInt
    : false;

  const hasApproval = borrowerCollateralAllowance && collateralAmountBigInt
    ? (borrowerCollateralAllowance as bigint) >= collateralAmountBigInt
    : false;

  const hasValidCollateralInput = Boolean(selectedCollateralToken && collateralAmountBigInt > BigInt(0));

  // Write hooks
  const { approveAsync, isPending: approveIsPending, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { acceptOfferAsync, isPending: acceptIsPending, isConfirming: isAcceptConfirming, isSuccess: acceptSuccess } = useAcceptLenderOffer();

  // Handle approval success
  useEffect(() => {
    if (approveSuccess) {
      toast.success('Approval successful!');
      refetchAllowance();
      setAcceptStep('accept');
    }
  }, [approveSuccess, refetchAllowance]);

  // Handle accept success
  useEffect(() => {
    if (acceptSuccess) {
      toast.success('Offer accepted! The loan is now active.');
      setShowAcceptModal(false);
      setIsAccepting(false);
      refetch();
      router.push('/dashboard');
    }
  }, [acceptSuccess, router, refetch]);

  // Handler to open accept modal
  const openAcceptModal = () => {
    if (!offer) {
      toast.error('Offer data not available. Please refresh the page.');
      return;
    }
    if (offerId === undefined) {
      toast.error('Invalid offer ID.');
      return;
    }
    setShowAcceptModal(true);
  };

  // Reset step when opening modal
  useEffect(() => {
    if (showAcceptModal) {
      setAcceptStep(hasApproval ? 'accept' : 'approve');
      setSimulationError('');
    }
  }, [showAcceptModal, hasApproval, borrowerCollateralAllowance, collateralAmountBigInt, borrowerCollateralBalance, hasZeroBalance, hasInsufficientBalance, isPriceStale]);

  const handleApprove = async () => {
    if (!offer) {
      toast.error('Offer data not available');
      return;
    }
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!selectedCollateralToken) {
      toast.error('Please select a collateral token');
      return;
    }
    if (collateralAmountBigInt === BigInt(0)) {
      toast.error('Unable to calculate required collateral. Please ensure prices are loaded.');
      return;
    }
    setSimulationError('');

    const tokenToApprove = selectedCollateralToken as Address;

    try {
      const simulation = await simulateContractWrite({
        address: tokenToApprove,
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          }
        ],
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.loanMarketPlace, collateralAmountBigInt],
        account: address,
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail');
        return;
      }

      await approveAsync(tokenToApprove, CONTRACT_ADDRESSES.loanMarketPlace, collateralAmountBigInt);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleAccept = async () => {
    if (!offer || offerId === undefined) {
      toast.error('Unable to accept: Missing offer data');
      return;
    }
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!selectedCollateralToken) {
      toast.error('Please select a collateral token');
      return;
    }
    if (collateralAmountBigInt === BigInt(0)) {
      toast.error('Unable to calculate required collateral. Please ensure prices are loaded.');
      return;
    }
    setIsAccepting(true);
    setSimulationError('');

    const collateralAssetToUse = selectedCollateralToken as Address;

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'acceptLenderOffer',
        args: [offerId, collateralAssetToUse, collateralAmountBigInt, parsedBorrowAmount],
        account: address,
      });

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Transaction would fail';
        setSimulationError(errorMsg);
        toast.error(errorMsg);
        setIsAccepting(false);
        return;
      }

      await acceptOfferAsync(offerId, collateralAssetToUse, collateralAmountBigInt, parsedBorrowAmount);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsAccepting(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  // Disabled states
  const isOpenModalDisabled =
    !offer ||
    !isBorrowAmountValid ||
    !hasValidCollateralInput ||
    !selectedCollateralToken ||
    (selectedCollateralToken && hasZeroBalance) ||
    hasInsufficientBalance ||
    isPriceStale ||
    isAccepting ||
    acceptIsPending ||
    isAcceptConfirming ||
    approveIsPending ||
    isApprovalConfirming;

  const isApproveDisabled =
    !offer ||
    !isBorrowAmountValid ||
    !hasValidCollateralInput ||
    !selectedCollateralToken ||
    (selectedCollateralToken && hasZeroBalance) ||
    hasInsufficientBalance ||
    isPriceStale ||
    approveIsPending ||
    isApprovalConfirming;

  const isAcceptDisabled =
    !offer ||
    !isBorrowAmountValid ||
    !hasValidCollateralInput ||
    !selectedCollateralToken ||
    (selectedCollateralToken && hasZeroBalance) ||
    hasInsufficientBalance ||
    isPriceStale ||
    isAccepting ||
    acceptIsPending ||
    isAcceptConfirming;

  if (offerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          <p className="text-sm text-gray-400">Loading offer details...</p>
        </div>
      </div>
    );
  }

  if (!offer || !offer.lender || offer.lender === '0x0000000000000000000000000000000000000000' || offer.lendAmount === BigInt(0)) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Offer Not Found</h2>
          <p className="text-gray-400 mb-6">
            This lender offer doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[offer.status] || STATUS_CONFIG[LoanRequestStatus.PENDING];
  const canAccept = offer.status === LoanRequestStatus.PENDING && !isLender && isConnected;

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-5 md:px-10 lg:px-20">
      <div className="max-w-[1920px] mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>
        </motion.div>

        {/* Hero Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 via-accent-500/5 to-transparent p-6 sm:p-8 mb-8"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            {/* Top row: ID + Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                    Lender Offer <span className="text-primary-400">#{offer.offerId.toString()}</span>
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {isLender ? 'Your lending offer' : 'Lending offer available'}
                  </p>
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.borderColor} border ${statusConfig.color} self-start sm:self-auto`}>
                {statusConfig.icon}
                {statusConfig.label}
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Coins className="w-3.5 h-3.5 text-primary-400" />
                  <span className="text-xs text-gray-400">Lend Amount</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-primary-400 truncate">
                  {formatTokenAmount(offer.lendAmount, lendDecimals)} <span className="text-sm text-gray-300">{lendSymbol}</span>
                </p>
                {lendUSD > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">~${lendUSD.toFixed(2)}</p>
                )}
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Percent className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs text-gray-400">Interest Rate</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-yellow-400">
                  {formatPercentage(offer.interestRate)}
                  <span className="text-xs font-normal text-gray-400 ml-1">APY</span>
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Timer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-gray-400">Duration</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">
                  {formatDuration(offer.duration)}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-gray-400">Collateral</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-accent-400">
                  Borrower Chooses
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Based on LTV</p>
              </div>
            </div>

            {/* Action Buttons */}
            {canAccept && (
              <div className="flex flex-wrap gap-3 mt-6">
                <Button
                  onClick={openAcceptModal}
                  icon={<Wallet className="w-4 h-4" />}
                  size="lg"
                  disabled={isOpenModalDisabled}
                >
                  Accept This Offer
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Offer Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Coins className="w-5 h-5 text-primary-400" />
                  <h2 className="text-lg font-bold">Offer Details</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Lend Amount</span>
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
                      </span>
                      {lendUSD > 0 && (
                        <p className="text-xs text-gray-500">~${lendUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Remaining Available</span>
                    <span className="font-semibold text-primary-400">
                      {formatTokenAmount(remainingAmount, lendDecimals)} {lendSymbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Interest Rate</span>
                    <span className="font-semibold text-yellow-400">
                      {formatPercentage(offer.interestRate)} APY
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Duration</span>
                    <span className="font-semibold">{formatDuration(offer.duration)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Required Collateral</span>
                    {selectedCollateralToken && collateralAmountBigInt > BigInt(0) ? (
                      <div className="text-right">
                        <span className="font-semibold">
                          {requiredCollateralFormatted} {collateralSymbol}
                        </span>
                        {minCollateralUSD > 0 && (
                          <p className="text-xs text-gray-500">~${minCollateralUSD.toFixed(2)} USD</p>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-accent-400">Select collateral below</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-gray-400">LTV Ratio</span>
                    {selectedCollateralToken && currentLTV > 0 ? (
                      <span className={`font-semibold ${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {currentLTV.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Depends on collateral chosen</span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Lender */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <User className="w-5 h-5 text-accent-400" />
                  <h2 className="text-lg font-bold">Lender</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-500/15 flex items-center justify-center">
                      <User className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">Wallet Address</p>
                        {isLender && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-500/20 text-primary-400">You</span>
                        )}
                      </div>
                      <p className="font-mono text-sm mt-0.5">{formatAddress(offer.lender, 6)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyAddress(offer.lender)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                    <a
                      href={`${DEFAULT_CHAIN.blockExplorer}/address/${offer.lender}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Borrowing Opportunity */}
            {!isLender && offer.status === LoanRequestStatus.PENDING && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="relative overflow-hidden rounded-2xl border border-accent-500/20 bg-gradient-to-br from-accent-500/10 via-accent-500/5 to-transparent p-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-5">
                      <TrendingUp className="w-5 h-5 text-accent-400" />
                      <h3 className="text-lg font-bold">Borrowing Opportunity</h3>
                    </div>
                    <div className="space-y-0">
                      {/* Borrow Amount Input */}
                      <div className="py-3 border-b border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-400">Amount to Borrow</span>
                          <span className="text-xs text-gray-500">
                            Max: {formatTokenAmount(remainingAmount, lendDecimals)} {lendSymbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={borrowAmountInput}
                            onChange={(e) => setBorrowAmountInput(e.target.value)}
                            placeholder="0.0"
                            className="input-field flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setBorrowAmountInput(formatUnits(remainingAmount, lendDecimals))}
                            className="px-3 py-2 text-xs font-semibold text-accent-400 hover:text-accent-300 bg-accent-400/10 hover:bg-accent-400/20 rounded-lg transition-colors"
                          >
                            MAX
                          </button>
                          <span className="text-sm text-gray-400 min-w-[50px]">{lendSymbol}</span>
                        </div>
                        {!isBorrowAmountValid && borrowAmountInput && (
                          <p className="text-xs text-red-400 mt-1">
                            {parsedBorrowAmount > remainingAmount
                              ? 'Amount exceeds available'
                              : 'Enter a valid amount'}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">You Will Receive</span>
                        <span className="font-semibold text-accent-400">
                          {borrowAmountInput || '0'} {lendSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Interest Rate</span>
                        <span className="font-semibold text-yellow-400">
                          {formatPercentage(offer.interestRate)} APY
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Collateral Required</span>
                        {selectedCollateralToken && collateralAmountBigInt > BigInt(0) ? (
                          <span className="font-semibold">
                            {requiredCollateralFormatted} {collateralSymbol}
                          </span>
                        ) : (
                          <span className="font-semibold text-accent-400">Select below</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-gray-400">Loan Duration</span>
                        <span className="font-semibold">{formatDuration(offer.duration)}</span>
                      </div>
                    </div>

                    {/* Dynamic Collateral Selection */}
                    {isConnected && (
                      <div className="mt-5 pt-5 border-t border-white/5 space-y-4">
                        <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
                          <p className="text-sm text-accent-400 font-medium">Choose Your Collateral</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Select a supported token as collateral. The required amount will be calculated based on LTV and current prices.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Select Collateral Token</label>
                          <select
                            value={selectedCollateralToken}
                            onChange={(e) => setSelectedCollateralToken(e.target.value as Address)}
                            className="w-full input-field bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                          >
                            <option value="">Select a token</option>
                            {TOKEN_LIST.filter(t => t.symbol !== 'USDC' && t.symbol !== 'USDT' && t.symbol !== 'DAI').map((token) => (
                              <option key={token.address} value={token.address}>
                                {token.symbol}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedCollateralToken && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Required Collateral (calculated)</label>
                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                              {collateralAmountBigInt > BigInt(0) ? (
                                <div className="flex justify-between items-center">
                                  <span className="text-xl font-bold text-white">
                                    {requiredCollateralFormatted} {collateralSymbol}
                                  </span>
                                  {minCollateralUSD > 0 && (
                                    <span className="text-sm text-gray-400">~${minCollateralUSD.toFixed(2)} USD</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">Loading prices...</span>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                Based on {currentLTV.toFixed(1)}% LTV
                              </p>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-2">
                              <span>Your Balance: {maxCollateralBalance} {collateralSymbol}</span>
                              {hasInsufficientBalance && (
                                <span className="text-red-400">Insufficient balance</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Price Staleness Warning */}
            {isPriceStale && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-red-400 font-medium">Price Data is Stale</p>
                      <p className="text-gray-400">
                        The price feed data is outdated. Transactions will fail until prices are refreshed.
                      </p>
                      <Button
                        onClick={handleRefreshPrices}
                        loading={isRefreshingPrice}
                        size="sm"
                        variant="secondary"
                        icon={<RefreshCw className="w-4 h-4" />}
                      >
                        Refresh Price Feeds
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <h3 className="text-lg font-bold mb-4">Status</h3>
                {offer.status === LoanRequestStatus.PENDING && !isLender && (
                  <div className="text-center py-6">
                    {isConnected ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-3">
                          <Wallet className="w-8 h-8 text-primary-400" />
                        </div>
                        <p className="text-primary-400 font-semibold">Available to Borrow</p>
                        <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                          You can accept this offer by providing collateral
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-gray-500/10 border border-gray-500/20 flex items-center justify-center mx-auto mb-3">
                          <Wallet className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-400 font-semibold">Connect Wallet</p>
                        <p className="text-gray-500 text-sm mt-1">Connect wallet to accept this offer</p>
                      </>
                    )}
                  </div>
                )}
                {offer.status === LoanRequestStatus.PENDING && isLender && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-8 h-8 text-yellow-400" />
                    </div>
                    <p className="text-yellow-400 font-semibold">Awaiting Acceptance</p>
                    <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                      Your offer is visible to borrowers
                    </p>
                  </div>
                )}
                {offer.status === LoanRequestStatus.FUNDED && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-green-400 font-semibold">Offer Accepted</p>
                    <p className="text-gray-400 text-sm mt-1">This loan is now active</p>
                  </div>
                )}
                {offer.status === LoanRequestStatus.CANCELLED && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                      <XCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-red-400 font-semibold">Offer Cancelled</p>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold">Timeline</h3>
                </div>
                <div className="space-y-4">
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-1 w-0.5 h-[calc(100%-8px)] bg-white/10" />

                    <div className="relative pb-4">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Created</span>
                        <span className="text-sm font-medium">{new Date(Number(offer.createdAt) * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="relative pb-4">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Expires</span>
                        <span className="text-sm font-medium">{formatTimeUntil(offer.expireAt)}</span>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-gray-500/20 border-2 border-gray-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Duration</span>
                        <span className="text-sm font-medium">{formatDuration(offer.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Security Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-accent-400" />
                  <h3 className="text-lg font-bold">Security</h3>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Choose your collateral token and the required amount is calculated based on current market prices and LTV ratios. Your collateral is secured by smart contract.
                  </p>
                  <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Collateral</span>
                      <span className="text-sm font-bold text-accent-400">Calculated from LTV</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Accept Offer Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setSimulationError('');
        }}
        title="Accept Lender Offer"
        size="md"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">You Will Receive</span>
              <span className="font-semibold text-accent-400">
                {borrowAmountInput || '0'} {lendSymbol}
              </span>
            </div>
            {parsedBorrowAmount < remainingAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Remaining in Offer</span>
                <span className="text-gray-400">
                  {formatTokenAmount(remainingAmount - parsedBorrowAmount, lendDecimals)} {lendSymbol}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="font-semibold text-yellow-400">
                {offer && formatPercentage(offer.interestRate)} APY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-semibold">
                {offer && formatDuration(offer.duration)}
              </span>
            </div>
          </div>

          {/* Collateral Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Collateral Token</label>
              <select
                value={selectedCollateralToken}
                onChange={(e) => setSelectedCollateralToken(e.target.value as Address)}
                className="w-full input-field bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
              >
                <option value="">Select a token</option>
                {TOKEN_LIST.filter(t => t.symbol !== 'USDC' && t.symbol !== 'USDT' && t.symbol !== 'DAI').map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>

            {selectedCollateralToken && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Required Collateral (calculated)</label>
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  {collateralAmountBigInt > BigInt(0) ? (
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-white">
                        {requiredCollateralFormatted} {collateralSymbol}
                      </span>
                      {minCollateralUSD > 0 && (
                        <span className="text-sm text-gray-400">~${minCollateralUSD.toFixed(2)} USD</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">Loading prices...</span>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Based on {currentLTV.toFixed(1)}% LTV
                  </p>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-400">
                    Balance: {maxCollateralBalance} {collateralSymbol}
                  </span>
                  {currentLTV > 0 && (
                    <span className={`${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                      LTV: {currentLTV.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Zero Balance Warning */}
          {(selectedCollateralToken && hasZeroBalance) && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">No {collateralSymbol} Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {collateralSymbol} tokens to accept this offer.
                  </p>
                  <Link
                    href="/faucet"
                    className="text-primary-400 hover:text-primary-300 hover:underline font-medium mt-2 inline-block"
                  >
                    Get test tokens from the faucet →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {hasInsufficientBalance && !hasZeroBalance && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Insufficient Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {requiredCollateralFormatted} {collateralSymbol} but only have {maxCollateralBalance}.
                  </p>
                  <Link
                    href="/faucet"
                    className="text-primary-400 hover:text-primary-300 hover:underline font-medium mt-2 inline-block"
                  >
                    Get more tokens from the faucet →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Price Staleness Warning in Modal */}
          {isPriceStale && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm space-y-2">
                  <p className="text-red-400 font-medium">Price Data is Stale</p>
                  <p className="text-gray-400">
                    Transaction will fail until price feeds are refreshed.
                  </p>
                  <Button
                    onClick={handleRefreshPrices}
                    loading={isRefreshingPrice}
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Refresh Price Feeds
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Steps */}
          {(hasValidCollateralInput && !hasZeroBalance && !hasInsufficientBalance && !isPriceStale) && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${acceptStep === 'approve' || hasApproval ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasApproval ? 'bg-green-500' : acceptStep === 'approve' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    {hasApproval ? <CheckCircle className="w-5 h-5" /> : '1'}
                  </div>
                  <span>Approve</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700" />
                <div className={`flex items-center gap-2 ${acceptStep === 'accept' ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acceptStep === 'accept' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    2
                  </div>
                  <span>Accept</span>
                </div>
              </div>

              {!hasApproval && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-gray-300">
                    <span className="text-yellow-400 font-medium">Why approve?</span> ERC-20 tokens require you to authorize the contract before it can lock your {collateralSymbol} as collateral. This is a standard security feature that protects your assets.
                  </p>
                </div>
              )}

              {!hasApproval ? (
                <Button
                  onClick={handleApprove}
                  loading={approveIsPending || isApprovalConfirming}
                  className="w-full"
                  disabled={isApproveDisabled}
                >
                  {approveIsPending ? 'Approving...' : isApprovalConfirming ? 'Confirming...' : `Approve ${collateralSymbol}`}
                </Button>
              ) : (
                <Button
                  onClick={handleAccept}
                  loading={isAccepting || acceptIsPending}
                  className="w-full"
                  disabled={isAcceptDisabled}
                >
                  Confirm & Accept Offer
                </Button>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowAcceptModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
