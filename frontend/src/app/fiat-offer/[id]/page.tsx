'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { parseUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useFiatLenderOffer,
  useCancelFiatLenderOffer,
  useAcceptFiatLenderOffer,
  FiatLenderOfferStatus,
} from '@/hooks/useFiatLoan';
import {
  useTokenPrice,
  useApproveToken,
  useTokenBalance,
  useTokenAllowance,
  useSupportedAssets,
  useRefreshMockPrice,
  useLTV,
} from '@/hooks/useContracts';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
  getTokenSymbol,
  getTokenDecimals,
} from '@/lib/utils';
import {
  formatCurrency,
  useExchangeRate,
  convertToUSDCents,
  convertFromUSDCents,
} from '@/hooks/useFiatOracle';
import {
  TOKEN_LIST,
  CONTRACT_ADDRESSES,
  DEFAULT_CHAIN
} from '@/config/contracts';
import { Address } from 'viem';
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Wallet,
  AlertCircle,
  Banknote,
  Loader2,
  RefreshCw,
  Percent,
  Timer,
  DollarSign,
  Activity,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import { Abi } from 'viem';

const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Status config
const STATUS_CONFIG: Partial<Record<FiatLenderOfferStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }>> = {
  [FiatLenderOfferStatus.ACTIVE]: {
    label: 'Active',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
    icon: <Activity className="w-4 h-4" />,
  },
  [FiatLenderOfferStatus.ACCEPTED]: {
    label: 'Accepted',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  [FiatLenderOfferStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function FiatOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [acceptStep, setAcceptStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');

  // State for collateral selection and borrow amount
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<Address | ''>('');
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [borrowAmountInput, setBorrowAmountInput] = useState<string>('');
  const [selectedDurationDays, setSelectedDurationDays] = useState<number>(0); // Will be set from offer

  // Fetch fiat lender offer data
  const { data: offerData, isLoading: offerLoading, refetch } = useFiatLenderOffer(offerId);

  // Parse offer data from contract - handle both object and tuple formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOffer = offerData as any;
  const offer = offerData ? {
    offerId: (rawOffer.offerId ?? rawOffer[0]) as bigint,
    lender: (rawOffer.lender ?? rawOffer[1]) as Address,
    fiatAmountCents: (rawOffer.fiatAmountCents ?? rawOffer[2]) as bigint,
    remainingAmountCents: (rawOffer.remainingAmountCents ?? rawOffer[3]) as bigint,
    borrowedAmountCents: (rawOffer.borrowedAmountCents ?? rawOffer[4]) as bigint,
    currency: (rawOffer.currency ?? rawOffer[5]) as string,
    minCollateralValueUSD: (rawOffer.minCollateralValueUSD ?? rawOffer[6]) as bigint,
    duration: (rawOffer.duration ?? rawOffer[7]) as bigint,
    interestRate: (rawOffer.interestRate ?? rawOffer[8]) as bigint,
    createdAt: (rawOffer.createdAt ?? rawOffer[9]) as bigint,
    expireAt: (rawOffer.expireAt ?? rawOffer[10]) as bigint,
    status: Number(rawOffer.status ?? rawOffer[11]) as FiatLenderOfferStatus,
    exchangeRateAtCreation: ((rawOffer.exchangeRateAtCreation ?? rawOffer[12]) as bigint) || BigInt(0),
    chainId: ((rawOffer.chainId ?? rawOffer[13]) as bigint) || BigInt(0),
  } : null;

  // Get supported assets from Configuration contract
  const { supportedTokens } = useSupportedAssets();
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  // Token info for selected collateral
  const collateralDecimals = selectedCollateralToken
    ? Number(getTokenDecimals(selectedCollateralToken as Address))
    : 18;
  const collateralSymbol = selectedCollateralToken
    ? getTokenSymbol(selectedCollateralToken as Address)
    : 'Select Token';

  // Get borrower's collateral balance and allowance
  const { data: borrowerCollateralBalance } = useTokenBalance(
    selectedCollateralToken as Address || undefined,
    address
  );
  const { data: borrowerCollateralAllowance, refetch: refetchAllowance } = useTokenAllowance(
    selectedCollateralToken as Address || undefined,
    address,
    CONTRACT_ADDRESSES.fiatLoanBridge
  );

  // Price data for USD value calculation
  const collateralPriceHook = useTokenPrice(selectedCollateralToken as Address || undefined);
  const collateralPrice = collateralPriceHook.price;

  // Price refresh hook
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // Check price staleness
  const isPriceStale = selectedCollateralToken ? collateralPriceHook.isStale : false;

  // Get LTV for the selected collateral token and selected duration
  const maxDurationDays = offer ? Math.floor(Number(offer.duration) / 86400) : 365;
  const { data: ltvBps } = useLTV(
    selectedCollateralToken as Address || undefined,
    selectedDurationDays > 0 ? selectedDurationDays : undefined
  );

  // Get exchange rate for currency conversion
  const { data: exchangeRate } = useExchangeRate(offer?.currency || 'USD');

  // Check if user is the lender (owner)
  const isLender = offer && address?.toLowerCase() === offer.lender.toLowerCase();

  // Parsed amounts
  const parsedBorrowAmountCents = borrowAmountInput
    ? BigInt(Math.round(parseFloat(borrowAmountInput) * 100))
    : BigInt(0);

  // Convert borrow amount to USD cents
  const borrowAmountUSDCents = offer?.currency === 'USD' || !exchangeRate
    ? parsedBorrowAmountCents
    : convertToUSDCents(parsedBorrowAmountCents, exchangeRate as bigint);

  // Calculate required collateral value in USD based on LTV
  const ltvValue = ltvBps ? Number(ltvBps) : 0;
  const requiredCollateralValueUSD = ltvValue > 0
    ? (Number(borrowAmountUSDCents) / 100) * 10000 / ltvValue
    : 0;

  // Calculate required collateral amount in tokens
  const calculatedCollateralAmount = collateralPrice && requiredCollateralValueUSD > 0
    ? (requiredCollateralValueUSD / (Number(collateralPrice) / 1e8))
    : 0;

  // Format for display and parsing
  const autoCalculatedCollateral = calculatedCollateralAmount > 0
    ? calculatedCollateralAmount.toFixed(collateralDecimals > 6 ? 8 : 6)
    : '';

  // Update collateral amount when auto-calculated value changes
  useEffect(() => {
    if (autoCalculatedCollateral && selectedCollateralToken && borrowAmountInput) {
      setCollateralAmount(autoCalculatedCollateral);
    }
  }, [autoCalculatedCollateral, selectedCollateralToken, borrowAmountInput]);

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  // Calculate collateral value in USD (for display)
  const collateralValueUSD = collateralPrice && parsedCollateralAmount > BigInt(0)
    ? (Number(parsedCollateralAmount) / Math.pow(10, collateralDecimals)) * Number(collateralPrice) / 1e8
    : 0;

  // Check if collateral meets minimum requirement (based on LTV calculation)
  const meetsMinimum = calculatedCollateralAmount > 0 && ltvValue > 0 && parsedBorrowAmountCents > BigInt(0);

  // Calculate interest amount
  const interestRateBps = offer?.interestRate ? Number(offer.interestRate) : 0;
  const interestAmountCents = parsedBorrowAmountCents > BigInt(0)
    ? (parsedBorrowAmountCents * BigInt(interestRateBps)) / BigInt(10000)
    : BigInt(0);

  // Total repayment in user's currency
  const totalRepaymentCents = parsedBorrowAmountCents + interestAmountCents;

  // Calculate collateral value in offer's currency (for non-USD currencies)
  const collateralValueUSDCents = BigInt(Math.round(collateralValueUSD * 100));
  const collateralValueInCurrency = offer?.currency !== 'USD' && exchangeRate
    ? convertFromUSDCents(collateralValueUSDCents, exchangeRate as bigint)
    : collateralValueUSDCents;

  // Balance calculations
  const hasEnoughBalance = borrowerCollateralBalance
    ? (borrowerCollateralBalance as bigint) >= parsedCollateralAmount
    : false;

  // Check if already approved
  const hasApproval = borrowerCollateralAllowance && parsedCollateralAmount
    ? (borrowerCollateralAllowance as bigint) >= parsedCollateralAmount
    : false;

  // Validate borrow amount (max is remaining amount)
  const maxBorrowAmount = offer ? Number(offer.remainingAmountCents) / 100 : 0;
  const isBorrowAmountValid = parsedBorrowAmountCents > BigInt(0) &&
    parsedBorrowAmountCents <= (offer?.remainingAmountCents || BigInt(0));

  // Form validation
  const isFormValid = offer &&
    selectedCollateralToken &&
    parsedCollateralAmount > BigInt(0) &&
    meetsMinimum &&
    hasEnoughBalance &&
    borrowAmountInput &&
    isBorrowAmountValid &&
    !isPriceStale &&
    ltvValue > 0;

  // Handle price refresh
  const handleRefreshPrice = async () => {
    if (!selectedCollateralToken || !collateralPriceHook.priceFeedAddress || !collateralPrice) return;
    try {
      await refreshPrice(
        collateralPriceHook.priceFeedAddress as Address,
        BigInt(collateralPrice),
        selectedCollateralToken as Address
      );
      toast.success('Price feed refreshed!');
      collateralPriceHook.refetch();
    } catch (error) {
      console.error('Failed to refresh price:', error);
      toast.error('Failed to refresh price feed');
    }
  };

  // Write hooks
  const { approveAsync, isPending: approveIsPending, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { acceptFiatLenderOffer, isPending: acceptIsPending, isConfirming: isAcceptConfirming, isSuccess: acceptSuccess, error: acceptError } = useAcceptFiatLenderOffer();
  const { cancelFiatLenderOffer, isPending: cancelIsPending, isSuccess: cancelSuccess, error: cancelError } = useCancelFiatLenderOffer();

  // Initialize borrow amount and duration when offer loads
  useEffect(() => {
    if (offer && offer.remainingAmountCents > BigInt(0) && !borrowAmountInput) {
      setBorrowAmountInput((Number(offer.remainingAmountCents) / 100).toFixed(2));
    }
    if (offer && offer.duration && selectedDurationDays === 0) {
      const offerDurationDays = Math.floor(Number(offer.duration) / 86400);
      setSelectedDurationDays(offerDurationDays);
    }
  }, [offer, borrowAmountInput, selectedDurationDays]);

  // Handle approval success
  useEffect(() => {
    if (approveSuccess) {
      toast.success('Collateral approved successfully!');
      refetchAllowance();
      setAcceptStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  // Handle accept success
  useEffect(() => {
    if (acceptSuccess) {
      toast.success('Fiat lender offer accepted! Your loan is now active.');
      setShowAcceptModal(false);
      setIsAccepting(false);
      refetch();
      router.push('/dashboard');
    }
  }, [acceptSuccess, router, refetch]);

  // Handle accept error
  useEffect(() => {
    if (acceptError) {
      console.error('Accept fiat offer error:', acceptError);
      const errorMessage = acceptError.message || 'Failed to accept fiat offer';
      setSimulationError(errorMessage);
      toast.error(errorMessage);
      setIsAccepting(false);
    }
  }, [acceptError]);

  // Handle cancel success
  useEffect(() => {
    if (cancelSuccess) {
      toast.success('Fiat lender offer cancelled successfully.');
      setShowCancelModal(false);
      setIsCancelling(false);
      refetch();
      router.push('/dashboard');
    }
  }, [cancelSuccess, router, refetch]);

  // Handle cancel error
  useEffect(() => {
    if (cancelError) {
      console.error('Cancel fiat offer error:', cancelError);
      toast.error(cancelError.message || 'Failed to cancel fiat offer');
      setIsCancelling(false);
    }
  }, [cancelError]);

  // Reset modal state (only when modal opens, not when offer changes)
  useEffect(() => {
    if (showAcceptModal && offer && offer.duration) {
      setAcceptStep('form');
      setCollateralAmount('');
      setSimulationError('');
      const offerDurationDays = Math.floor(Number(offer.duration) / 86400);
      setSelectedDurationDays(offerDurationDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAcceptModal]);

  const handleProceedToApprove = () => {
    if (!isFormValid) return;

    if (hasApproval) {
      setAcceptStep('confirm');
    } else {
      setAcceptStep('approve');
    }
  };

  const handleApprove = async () => {
    if (!selectedCollateralToken || parsedCollateralAmount === BigInt(0)) return;
    setSimulationError('');

    try {
      await approveAsync(
        selectedCollateralToken as Address,
        CONTRACT_ADDRESSES.fiatLoanBridge,
        parsedCollateralAmount
      );
    } catch (error) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleConfirmAccept = async () => {
    if (!offer || !offerId || !selectedCollateralToken) return;
    setIsAccepting(true);
    setSimulationError('');

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.fiatLoanBridge,
        abi: FiatLoanBridgeABI,
        functionName: 'acceptFiatLenderOffer',
        args: [offerId, selectedCollateralToken, parsedCollateralAmount, parsedBorrowAmountCents],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        setIsAccepting(false);
        return;
      }

      await acceptFiatLenderOffer(offerId, selectedCollateralToken as Address, parsedCollateralAmount, parsedBorrowAmountCents);
    } catch (error) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsAccepting(false);
    }
  };

  const handleCancel = async () => {
    if (!offer || !offerId) return;
    setIsCancelling(true);

    try {
      await cancelFiatLenderOffer(offerId);
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel offer');
      setIsCancelling(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  if (offerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          <p className="text-sm text-gray-400">Loading offer details...</p>
        </div>
      </div>
    );
  }

  // Check if offer exists
  if (!offer || !offer.lender || offer.lender === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Offer Not Found</h2>
          <p className="text-gray-400 mb-6">
            This fiat lender offer doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[offer.status] || STATUS_CONFIG[FiatLenderOfferStatus.ACTIVE]!;
  const canAccept = offer.status === FiatLenderOfferStatus.ACTIVE && !isLender && isConnected;
  const canCancel = offer.status === FiatLenderOfferStatus.ACTIVE && isLender;

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
          className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent p-6 sm:p-8 mb-8"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            {/* Top row: ID + Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                    Fiat Offer <span className="text-green-400">#{offer.offerId.toString()}</span>
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {isLender ? 'Your lending offer' : 'Supplier offering fiat funds'}
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
                  <DollarSign className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-gray-400">Fiat Amount</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-green-400 truncate">
                  {formatCurrency(offer.fiatAmountCents, offer.currency)}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-gray-400">Interest Rate</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-400">
                  {formatPercentage(offer.interestRate)}
                  <span className="text-xs font-normal text-gray-400 ml-1">APY</span>
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Timer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-gray-400">Max Duration</span>
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
                  Dynamic (LTV)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Auto-calculated</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {canAccept && (
                <Button
                  onClick={() => setShowAcceptModal(true)}
                  icon={<Wallet className="w-4 h-4" />}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Accept This Offer
                </Button>
              )}
              {canCancel && (
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="danger"
                  size="lg"
                >
                  Cancel Offer
                </Button>
              )}
            </div>
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
                  <Banknote className="w-5 h-5 text-green-400" />
                  <h2 className="text-lg font-bold">Offer Details</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Total Offer Amount</span>
                    <span className="font-semibold text-green-400">
                      {formatCurrency(offer.fiatAmountCents, offer.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Remaining Available</span>
                    <span className="font-semibold text-green-400">
                      {formatCurrency(offer.remainingAmountCents, offer.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Already Borrowed</span>
                    <span className="font-semibold">
                      {formatCurrency(offer.borrowedAmountCents, offer.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Currency</span>
                    <span className="font-semibold">{offer.currency}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Interest Rate</span>
                    <span className="font-semibold text-emerald-400">
                      {formatPercentage(offer.interestRate)} APY
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Max Duration</span>
                    <span className="font-semibold">{formatDuration(offer.duration)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-gray-400">Collateral</span>
                    <span className="font-semibold text-accent-400">Dynamic (LTV-based)</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Supplier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <User className="w-5 h-5 text-green-400" />
                  <h2 className="text-lg font-bold">Supplier</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                      <User className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">Wallet Address</p>
                        {isLender && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">You</span>
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

            {/* Borrowing Opportunity (for borrowers) */}
            {!isLender && offer.status === FiatLenderOfferStatus.ACTIVE && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent p-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-5">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-bold">Borrowing Opportunity</h3>
                    </div>
                    <div className="space-y-0">
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Available to Borrow</span>
                        <span className="font-semibold text-green-400">
                          {formatCurrency(offer.remainingAmountCents, offer.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Interest Rate</span>
                        <span className="font-semibold text-emerald-400">
                          {formatPercentage(offer.interestRate)} APY
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Collateral</span>
                        <span className="font-semibold text-accent-400">
                          Auto-calculated based on LTV
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-gray-400">Max Loan Duration</span>
                        <span className="font-semibold">{formatDuration(offer.duration)}</span>
                      </div>
                    </div>

                    {isConnected && (
                      <div className="mt-5 pt-5 border-t border-white/5">
                        <Button
                          onClick={() => setShowAcceptModal(true)}
                          className="w-full bg-green-600 hover:bg-green-700"
                          icon={<Wallet className="w-4 h-4" />}
                        >
                          Accept This Offer
                        </Button>
                      </div>
                    )}

                    {!isConnected && (
                      <div className="mt-5 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex gap-2 items-center">
                          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                          <p className="text-sm text-yellow-400">
                            Connect your wallet to accept this offer
                          </p>
                        </div>
                      </div>
                    )}
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
                {offer.status === FiatLenderOfferStatus.ACTIVE && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                      {isLender ? (
                        <Clock className="w-8 h-8 text-green-400" />
                      ) : isConnected ? (
                        <Wallet className="w-8 h-8 text-green-400" />
                      ) : (
                        <Wallet className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    {isLender ? (
                      <>
                        <p className="text-green-400 font-semibold">Active Offer</p>
                        <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                          Your offer is visible to borrowers
                        </p>
                      </>
                    ) : isConnected ? (
                      <>
                        <p className="text-green-400 font-semibold">Available to Borrow</p>
                        <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                          You can accept this offer by providing collateral
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-400 font-semibold">Connect Wallet</p>
                        <p className="text-gray-500 text-sm mt-1">Connect wallet to accept this offer</p>
                      </>
                    )}
                  </div>
                )}
                {offer.status === FiatLenderOfferStatus.ACCEPTED && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-blue-400 font-semibold">Offer Accepted</p>
                    <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                      Loans have been created from this offer
                    </p>
                  </div>
                )}
                {offer.status === FiatLenderOfferStatus.CANCELLED && (
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

                    {offer.expireAt > BigInt(0) && (
                      <div className="relative pb-4">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Expires</span>
                          <span className="text-sm font-medium">{new Date(Number(offer.expireAt) * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-gray-500/20 border-2 border-gray-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Max Duration</span>
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
                    Fiat loans require collateral to be locked in the smart contract. The supplier will disburse fiat funds off-chain after you accept.
                  </p>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Collateral</span>
                      <span className="text-sm font-bold text-green-400">Calculated from LTV</span>
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
        title="Accept Fiat Lender Offer"
        size="md"
      >
        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`flex items-center gap-2 ${acceptStep === 'form' ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acceptStep === 'form' ? 'bg-green-500' : 'bg-gray-700'}`}>
                1
              </div>
              <span className="text-sm">Details</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-700" />
            <div className={`flex items-center gap-2 ${acceptStep === 'approve' ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acceptStep === 'approve' ? 'bg-green-500' : hasApproval ? 'bg-green-500' : 'bg-gray-700'}`}>
                {hasApproval ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <span className="text-sm">Approve</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-700" />
            <div className={`flex items-center gap-2 ${acceptStep === 'confirm' ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acceptStep === 'confirm' ? 'bg-green-500' : 'bg-gray-700'}`}>
                3
              </div>
              <span className="text-sm">Confirm</span>
            </div>
          </div>

          {/* Form Step */}
          {acceptStep === 'form' && (
            <div className="space-y-4">
              {/* Borrow Amount */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount to Borrow ({offer?.currency})
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={borrowAmountInput || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setBorrowAmountInput(value);
                      }
                    }}
                    placeholder="0.00"
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setBorrowAmountInput(maxBorrowAmount.toFixed(2))}
                    className="px-3 py-2 text-xs font-semibold text-green-400 hover:text-green-300 bg-green-400/10 hover:bg-green-400/20 rounded-lg transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Max available: {formatCurrency(offer?.remainingAmountCents || BigInt(0), offer?.currency || 'USD')}</span>
                  {offer?.currency !== 'USD' && borrowAmountUSDCents > BigInt(0) && (
                    <span className="text-green-400">≈ ${(Number(borrowAmountUSDCents) / 100).toFixed(2)} USD</span>
                  )}
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Loan Duration (Days) <span className="text-xs text-gray-500">- Max: {maxDurationDays} days</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={selectedDurationDays || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setSelectedDurationDays(1);
                      } else if (/^\d+$/.test(value)) {
                        const days = parseInt(value);
                        const clampedDays = Math.max(1, Math.min(maxDurationDays, days));
                        setSelectedDurationDays(clampedDays);
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.target.value || parseInt(e.target.value) < 1) {
                        setSelectedDurationDays(1);
                      }
                    }}
                    placeholder={maxDurationDays.toString()}
                    className="input-field flex-1"
                  />
                  <div className="flex gap-1">
                    {maxDurationDays >= 7 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDurationDays(7)}
                        className="px-2 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
                      >
                        7D
                      </button>
                    )}
                    {maxDurationDays >= 30 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDurationDays(30)}
                        className="px-2 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
                      >
                        30D
                      </button>
                    )}
                    {maxDurationDays >= 90 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDurationDays(90)}
                        className="px-2 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
                      >
                        90D
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedDurationDays(maxDurationDays)}
                      className="px-2 py-2 text-xs font-semibold text-green-400 hover:text-green-300 bg-green-400/10 hover:bg-green-400/20 rounded-lg transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Min: 1 day | Your choice ≤ Lender&apos;s max</span>
                  {selectedDurationDays > 0 && (
                    <span className="text-primary-400">
                      ≈ {Math.floor(selectedDurationDays / 30)}mo {selectedDurationDays % 30}d
                      {ltvValue > 0 && ` • LTV: ${(ltvValue / 100).toFixed(1)}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Collateral Token Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Collateral Token</label>
                <select
                  value={selectedCollateralToken}
                  onChange={(e) => {
                    setSelectedCollateralToken(e.target.value as Address);
                    setCollateralAmount('');
                  }}
                  className="w-full input-field bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                >
                  <option value="">Select a token</option>
                  {availableTokens.filter(t => t.symbol !== 'USDC' && t.symbol !== 'USDT' && t.symbol !== 'DAI').map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Collateral Amount (Auto-calculated) */}
              {selectedCollateralToken && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Required Collateral <span className="text-xs text-gray-500">- Auto-calculated based on LTV</span>
                  </label>

                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    {collateralAmount && parsedCollateralAmount > BigInt(0) ? (
                      <div className="space-y-1">
                        <div className="text-center">
                          <span className="text-white font-bold text-2xl">
                            {parseFloat(collateralAmount).toFixed(6)} {collateralSymbol}
                          </span>
                        </div>
                        <div className="text-center text-sm text-gray-400">
                          {offer?.currency !== 'USD' ? (
                            <span>
                              ≈ {formatCurrency(collateralValueInCurrency, offer?.currency || 'USD')}{' '}
                              <span className="text-gray-500">(${collateralValueUSD.toFixed(2)} USD)</span>
                            </span>
                          ) : (
                            <span>≈ ${collateralValueUSD.toFixed(2)} USD</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-gray-500">
                        Select a token and enter borrow amount to calculate collateral
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>
                      Your Balance: {borrowerCollateralBalance
                        ? formatTokenAmount(borrowerCollateralBalance as bigint, collateralDecimals)
                        : '0'} {collateralSymbol}
                    </span>
                    {ltvValue > 0 && (
                      <span className="text-primary-400">LTV: {(ltvValue / 100).toFixed(1)}%</span>
                    )}
                  </div>

                  {/* Balance check */}
                  {parsedCollateralAmount > BigInt(0) && !hasEnoughBalance && (
                    <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">Insufficient {collateralSymbol} balance</span>
                      </div>
                    </div>
                  )}

                  {parsedCollateralAmount > BigInt(0) && hasEnoughBalance && (
                    <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Sufficient collateral balance</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Price Staleness Warning */}
              {isPriceStale && selectedCollateralToken && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-red-400 font-medium">Price Data is Stale</p>
                      <p className="text-gray-400">
                        The price feed data is outdated. Transactions will fail until prices are refreshed.
                      </p>
                      <Button
                        onClick={handleRefreshPrice}
                        loading={isRefreshingPrice}
                        size="sm"
                        variant="secondary"
                        icon={<RefreshCw className="w-4 h-4" />}
                      >
                        Refresh Price Feed
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {isFormValid && (
                <div className="glass-card p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Summary</h4>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">You will receive</span>
                    <span className="text-green-400 font-medium">
                      {formatCurrency(parsedBorrowAmountCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  {offer?.currency !== 'USD' && borrowAmountUSDCents > BigInt(0) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Equivalent in USD</span>
                      <span className="text-gray-300">
                        ${(Number(borrowAmountUSDCents) / 100).toFixed(2)} USD
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Collateral locked</span>
                    <span>{parseFloat(collateralAmount).toFixed(6)} {collateralSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Collateral value</span>
                    <span className="text-primary-400">
                      {offer?.currency !== 'USD' ? (
                        <>
                          {formatCurrency(collateralValueInCurrency, offer?.currency || 'USD')}{' '}
                          <span className="text-gray-500 text-xs">(${collateralValueUSD.toFixed(2)})</span>
                        </>
                      ) : (
                        `$${collateralValueUSD.toFixed(2)} USD`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Interest ({formatPercentage(offer?.interestRate || BigInt(0))})</span>
                    <span className="text-yellow-400">
                      {formatCurrency(interestAmountCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-gray-300 font-medium">Total Repayment</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(totalRepaymentCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Duration</span>
                    <span>{selectedDurationDays} days</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleProceedToApprove}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!isFormValid}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Approve Step */}
          {acceptStep === 'approve' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Approve Collateral</h3>
                <p className="text-gray-400 text-sm">
                  Approve {collateralAmount} {collateralSymbol} to be used as collateral for this loan.
                </p>
              </div>

              {simulationError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-red-400 font-medium">Error</p>
                      <p className="text-gray-400 mt-1">{simulationError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleApprove}
                loading={approveIsPending || isApprovalConfirming}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Approve {collateralSymbol}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setAcceptStep('form')}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}

          {/* Confirm Step */}
          {acceptStep === 'confirm' && (
            <div className="space-y-4">
              {/* Final Summary */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="font-semibold">Transaction Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">You Will Receive</span>
                    <span className="text-green-400 font-medium">
                      {formatCurrency(parsedBorrowAmountCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  {offer?.currency !== 'USD' && borrowAmountUSDCents > BigInt(0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Equivalent in USD</span>
                      <span className="text-gray-300">
                        ${(Number(borrowAmountUSDCents) / 100).toFixed(2)} USD
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-400">Collateral Locked</span>
                    <span>{parseFloat(collateralAmount).toFixed(6)} {collateralSymbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Collateral Value</span>
                    <span className="text-primary-400">
                      {offer?.currency !== 'USD' ? (
                        <>
                          {formatCurrency(collateralValueInCurrency, offer?.currency || 'USD')}{' '}
                          <span className="text-gray-500 text-xs">(${collateralValueUSD.toFixed(2)})</span>
                        </>
                      ) : (
                        `$${collateralValueUSD.toFixed(2)} USD`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Interest ({formatPercentage(offer?.interestRate || BigInt(0))})</span>
                    <span className="text-yellow-400">
                      {formatCurrency(interestAmountCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-gray-300 font-medium">Total Repayment</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(totalRepaymentCents, offer?.currency || 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration</span>
                    <span>{selectedDurationDays} days</span>
                  </div>
                </div>
              </div>

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

              {/* Info */}
              <div className="flex gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300">
                  Your collateral will be locked until the loan is repaid. The supplier will disburse the fiat amount to you off-chain after accepting.
                </p>
              </div>

              <Button
                onClick={handleConfirmAccept}
                loading={isAccepting || acceptIsPending || isAcceptConfirming}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Confirm & Accept Offer
              </Button>

              <Button
                variant="secondary"
                onClick={() => setAcceptStep('form')}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Cancel Offer Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Fiat Offer"
        size="sm"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-gray-400">
              Are you sure you want to cancel this fiat lender offer? This action cannot be undone.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleCancel}
              loading={isCancelling || cancelIsPending}
              className="flex-1"
              variant="secondary"
            >
              Cancel Offer
            </Button>
            <Button
              onClick={() => setShowCancelModal(false)}
              className="flex-1"
            >
              Keep Offer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
