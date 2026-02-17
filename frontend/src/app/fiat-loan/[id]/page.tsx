'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useFiatLoan,
  useFiatLoanTotalDebt,
  useAcceptFiatLoanRequest,
  useCancelFiatLoanRequest,
  FiatLoanStatus,
} from '@/hooks/useFiatLoan';
import { useTokenPrice } from '@/hooks/useContracts';
import { useSupplierDetails } from '@/hooks/useSupplier';
import { formatCurrency } from '@/hooks/useFiatOracle';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
  getTokenSymbol,
  getTokenDecimals,
  getHealthFactorColor,
  calculateHealthFactorFromUSD,
  convertFiatToUSD,
} from '@/lib/utils';
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
  DollarSign,
  AlertCircle,
  Banknote,
  Loader2,
  Percent,
  Timer,
  Wallet,
  Activity,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN, CONTRACT_ADDRESSES } from '@/config/contracts';
import { Address } from 'viem';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import { Abi } from 'viem';

const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Status config
const STATUS_CONFIG: Record<FiatLoanStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  [FiatLoanStatus.PENDING_SUPPLIER]: {
    label: 'Pending Supplier',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-yellow-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  [FiatLoanStatus.ACTIVE]: {
    label: 'Active',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-green-500/30',
    icon: <Activity className="w-4 h-4" />,
  },
  [FiatLoanStatus.REPAID]: {
    label: 'Repaid',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  [FiatLoanStatus.LIQUIDATED]: {
    label: 'Liquidated',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  [FiatLoanStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    borderColor: 'border-gray-500/30',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function FiatLoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showFundModal, setShowFundModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [simulationError, setSimulationError] = useState<string>('');

  // Fetch fiat loan data
  const { data: loanData, isLoading: loanLoading, refetch } = useFiatLoan(loanId);

  // Parse loan data from contract - handle both object and tuple formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLoan = loanData as any;
  const loan = loanData ? {
    loanId: (rawLoan.loanId ?? rawLoan[0]) as bigint,
    borrower: (rawLoan.borrower ?? rawLoan[1]) as Address,
    supplier: (rawLoan.supplier ?? rawLoan[2]) as Address,
    collateralAsset: (rawLoan.collateralAsset ?? rawLoan[3]) as Address,
    collateralAmount: (rawLoan.collateralAmount ?? rawLoan[4]) as bigint,
    fiatAmountCents: (rawLoan.fiatAmountCents ?? rawLoan[5]) as bigint,
    currency: (rawLoan.currency ?? rawLoan[6]) as string,
    interestRate: (rawLoan.interestRate ?? rawLoan[7]) as bigint,
    duration: (rawLoan.duration ?? rawLoan[8]) as bigint,
    status: Number(rawLoan.status ?? rawLoan[9]) as FiatLoanStatus,
    createdAt: (rawLoan.createdAt ?? rawLoan[10]) as bigint,
    activatedAt: (rawLoan.activatedAt ?? rawLoan[11]) as bigint,
    dueDate: (rawLoan.dueDate ?? rawLoan[12]) as bigint,
    gracePeriodEnd: (rawLoan.gracePeriodEnd ?? rawLoan[13]) as bigint,
    claimableAmountCents: (rawLoan.claimableAmountCents ?? rawLoan[14]) as bigint,
    fundsWithdrawn: (rawLoan.fundsWithdrawn ?? rawLoan[15]) as boolean,
    repaymentDepositId: (rawLoan.repaymentDepositId ?? rawLoan[16]) as `0x${string}`,
    exchangeRateAtCreation: ((rawLoan.exchangeRateAtCreation ?? rawLoan[17]) as bigint) || BigInt(0),
    chainId: ((rawLoan.chainId ?? rawLoan[18]) as bigint) || BigInt(0),
  } : null;

  // Get total debt for active loans
  const { data: totalDebt } = useFiatLoanTotalDebt(
    loan?.status === FiatLoanStatus.ACTIVE ? loanId : undefined
  );

  // Token info
  const collateralSymbol = loan ? getTokenSymbol(loan.collateralAsset) : '';
  const collateralDecimals = loan ? Number(getTokenDecimals(loan.collateralAsset)) : 18;

  // Check if user is the borrower or supplier
  const isBorrower = loan && address?.toLowerCase() === loan.borrower.toLowerCase();
  const isSupplier = loan && address?.toLowerCase() === loan.supplier.toLowerCase();

  // Check if user is a verified supplier (for fiat loans)
  const { isVerified: isVerifiedSupplier, isActive: isSupplierActive } = useSupplierDetails(address);
  const canActAsSupplier = isVerifiedSupplier && isSupplierActive;

  // Price data for USD values
  const collateralPriceHook = useTokenPrice(loan?.collateralAsset);
  const collateralPrice = collateralPriceHook.price;

  // Calculate USD values
  const collateralUSD = loan && collateralPrice
    ? (Number(loan.collateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // Write hooks
  const { acceptFiatLoanRequest, isPending: acceptIsPending, isSuccess: acceptSuccess, error: acceptError } = useAcceptFiatLoanRequest();
  const { cancelFiatLoanRequest, isPending: cancelIsPending, isSuccess: cancelSuccess, error: cancelError } = useCancelFiatLoanRequest();

  // Handle accept success
  useEffect(() => {
    if (acceptSuccess) {
      toast.success('Fiat loan funded successfully! The loan is now active.');
      setShowFundModal(false);
      setIsFunding(false);
      refetch();
    }
  }, [acceptSuccess, refetch]);

  // Handle cancel success
  useEffect(() => {
    if (cancelSuccess) {
      toast.success('Fiat loan request cancelled successfully.');
      setShowCancelModal(false);
      setIsCancelling(false);
      refetch();
      router.push('/dashboard');
    }
  }, [cancelSuccess, router, refetch]);

  // Handle accept/fund error
  useEffect(() => {
    if (acceptError) {
      console.error('Accept fiat loan error:', acceptError);
      const errorMessage = acceptError.message || 'Failed to fund fiat loan';
      setSimulationError(errorMessage);
      toast.error(errorMessage);
      setIsFunding(false);
    }
  }, [acceptError]);

  // Handle cancel error
  useEffect(() => {
    if (cancelError) {
      console.error('Cancel fiat loan error:', cancelError);
      toast.error(cancelError.message || 'Failed to cancel fiat loan');
      setIsCancelling(false);
    }
  }, [cancelError]);

  // Reset simulation error when modal opens
  useEffect(() => {
    if (showFundModal) {
      setSimulationError('');
    }
  }, [showFundModal]);

  const handleFund = async () => {
    if (!loan || !loanId) return;
    setIsFunding(true);
    setSimulationError('');

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.fiatLoanBridge,
        abi: FiatLoanBridgeABI,
        functionName: 'acceptFiatLoanRequest',
        args: [loanId],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        setIsFunding(false);
        return;
      }

      await acceptFiatLoanRequest(loanId);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsFunding(false);
    }
  };

  const handleCancel = async () => {
    if (!loan || !loanId) return;
    setIsCancelling(true);

    try {
      await cancelFiatLoanRequest(loanId);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to cancel fiat loan';
      toast.error(errorMsg);
      setIsCancelling(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  // Calculate health factor on frontend (FiatLoanBridge has no calculateHealthFactor function)
  const fiatAmountUSD = loan ? convertFiatToUSD(loan.fiatAmountCents, loan.currency, loan.exchangeRateAtCreation) : 0;
  const healthFactorValue = collateralUSD > 0 && fiatAmountUSD > 0
    ? calculateHealthFactorFromUSD(collateralUSD, fiatAmountUSD)
    : 0;
  const healthFactorDisplay = healthFactorValue > 0 ? `${healthFactorValue.toFixed(0)}%` : '--';

  // Format total debt
  const totalDebtCents = totalDebt ? Number(totalDebt as bigint) : 0;
  const totalDebtDisplay = totalDebtCents / 100;

  if (loanLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          <p className="text-sm text-gray-400">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loan || !loan.borrower || loan.borrower === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Fiat Loan Not Found</h2>
          <p className="text-gray-400 mb-6">
            This fiat loan doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[loan.status];
  const canFund = loan.status === FiatLoanStatus.PENDING_SUPPLIER && !isBorrower && isConnected && canActAsSupplier;
  const showSupplierNotice = loan.status === FiatLoanStatus.PENDING_SUPPLIER && !isBorrower && isConnected && !canActAsSupplier;
  const canCancel = loan.status === FiatLoanStatus.PENDING_SUPPLIER && isBorrower;

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-5 md:px-10 lg:px-20">
      <div className="max-w-[1920px] mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
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
                    Fiat Loan <span className="text-green-400">#{loan.loanId.toString()}</span>
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {isBorrower ? 'Your fiat loan request' : isSupplier ? 'You funded this loan' : 'Fiat loan request'}
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
                  {formatCurrency(loan.fiatAmountCents, loan.currency)}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-gray-400">Interest Rate</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-400">
                  {formatPercentage(loan.interestRate)}
                  <span className="text-xs font-normal text-gray-400 ml-1">APY</span>
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Timer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-gray-400">Duration</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">
                  {formatDuration(loan.duration)}
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-gray-400">Collateral</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white truncate">
                  {formatTokenAmount(loan.collateralAmount, collateralDecimals)} <span className="text-sm text-gray-300">{collateralSymbol}</span>
                </p>
                {collateralUSD > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">~${collateralUSD.toFixed(2)}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {canFund && (
                <Button
                  onClick={() => setShowFundModal(true)}
                  icon={<DollarSign className="w-4 h-4" />}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Fund This Loan
                </Button>
              )}
              {showSupplierNotice && (
                <Link href="/dashboard#supplier">
                  <Button
                    icon={<ArrowUpRight className="w-4 h-4" />}
                    size="lg"
                    className="bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30"
                  >
                    Register as Supplier
                  </Button>
                </Link>
              )}
              {canCancel && (
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="danger"
                  size="lg"
                >
                  Cancel Request
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Health & Debt Info for Active Loans */}
            {loan.status === FiatLoanStatus.ACTIVE && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <div className="flex items-center gap-2 mb-5">
                    <Activity className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-bold">Loan Health</h2>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-transparent p-5 border border-white/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-accent-400" />
                        <p className="text-sm text-gray-400">Health Factor</p>
                      </div>
                      <p className={`text-3xl font-bold ${getHealthFactorColor(healthFactorValue)}`}>
                        {healthFactorDisplay}
                      </p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          healthFactorValue >= 150
                            ? 'bg-green-500/15 text-green-400'
                            : healthFactorValue >= 100
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {healthFactorValue >= 150 ? 'Healthy' : healthFactorValue >= 100 ? 'Warning' : 'At Risk'}
                        </span>
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-transparent p-5 border border-white/5">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <p className="text-sm text-gray-400">Total Debt</p>
                      </div>
                      <p className="text-3xl font-bold text-green-400">
                        {totalDebtDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{loan.currency} (Principal + Interest)</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Loan Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Banknote className="w-5 h-5 text-green-400" />
                  <h2 className="text-lg font-bold">Loan Details</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Fiat Amount</span>
                    <span className="font-semibold text-green-400">
                      {formatCurrency(loan.fiatAmountCents, loan.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Interest Rate</span>
                    <span className="font-semibold text-emerald-400">
                      {formatPercentage(loan.interestRate)} APY
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Duration</span>
                    <span className="font-semibold">{formatDuration(loan.duration)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Collateral Locked</span>
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
                      </span>
                      {collateralUSD > 0 && (
                        <p className="text-xs text-gray-500">~${collateralUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-gray-400">Currency</span>
                    <span className="font-semibold">{loan.currency}</span>
                  </div>
                  {loan.exchangeRateAtCreation > BigInt(0) && (
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-gray-400">Exchange Rate at Creation</span>
                      <span className="font-semibold">
                        {(Number(loan.exchangeRateAtCreation) / 1e8).toFixed(4)} {loan.currency}/USD
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Participants */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <User className="w-5 h-5 text-primary-400" />
                  <h2 className="text-lg font-bold">Participants</h2>
                </div>
                <div className="space-y-3">
                  {/* Borrower */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">Borrower</p>
                          {isBorrower && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-500/20 text-primary-400">You</span>
                          )}
                        </div>
                        <p className="font-mono text-sm mt-0.5">{formatAddress(loan.borrower, 6)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyAddress(loan.borrower)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                      <a
                        href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.borrower}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>

                  {/* Supplier */}
                  {loan.supplier && loan.supplier !== '0x0000000000000000000000000000000000000000' && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                          <Banknote className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">Supplier</p>
                            {isSupplier && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">You</span>
                            )}
                          </div>
                          <p className="font-mono text-sm mt-0.5">{formatAddress(loan.supplier, 6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyAddress(loan.supplier)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                        <a
                          href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.supplier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Funding Opportunity (for suppliers) */}
            {!isBorrower && loan.status === FiatLoanStatus.PENDING_SUPPLIER && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent p-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-5">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-bold">Funding Opportunity</h3>
                    </div>
                    <div className="space-y-0">
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">You Provide (Fiat)</span>
                        <span className="font-semibold text-green-400">
                          {formatCurrency(loan.fiatAmountCents, loan.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Interest Rate</span>
                        <span className="font-semibold text-emerald-400">
                          {formatPercentage(loan.interestRate)} APY
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-sm text-gray-400">Collateral Securing Loan</span>
                        <span className="font-semibold">
                          {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
                          {collateralUSD > 0 && (
                            <span className="text-gray-500 text-xs ml-1">(~${collateralUSD.toFixed(2)})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-gray-400">Loan Duration</span>
                        <span className="font-semibold">{formatDuration(loan.duration)}</span>
                      </div>
                    </div>

                    {canActAsSupplier ? (
                      <div className="mt-5 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-gray-300">
                          As a supplier, you will provide fiat currency to the borrower off-chain.
                          The borrower&apos;s crypto collateral is locked in the smart contract as security.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-400 font-medium mb-1">Supplier Registration Required</p>
                            <p className="text-sm text-gray-400 mb-3">
                              To fund fiat loan requests, you need to register and get verified as a supplier.
                            </p>
                            <Link href="/dashboard#supplier">
                              <Button size="sm" className="bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30">
                                Register as Supplier
                              </Button>
                            </Link>
                          </div>
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
                {loan.status === FiatLoanStatus.PENDING_SUPPLIER && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-8 h-8 text-yellow-400" />
                    </div>
                    <p className="text-yellow-400 font-semibold">Awaiting Supplier</p>
                    <p className="text-gray-400 text-sm mt-1 max-w-[200px] mx-auto">
                      Waiting for a fiat supplier to fund this loan
                    </p>
                  </div>
                )}
                {loan.status === FiatLoanStatus.ACTIVE && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-green-400 font-semibold">Loan Active</p>
                    <p className="text-gray-400 text-sm mt-1">This loan is currently active</p>
                  </div>
                )}
                {loan.status === FiatLoanStatus.REPAID && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-blue-400 font-semibold">Loan Repaid</p>
                    <p className="text-gray-400 text-sm mt-1">This loan has been fully repaid</p>
                  </div>
                )}
                {loan.status === FiatLoanStatus.LIQUIDATED && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-red-400 font-semibold">Loan Liquidated</p>
                    <p className="text-gray-400 text-sm mt-1">Collateral was liquidated</p>
                  </div>
                )}
                {loan.status === FiatLoanStatus.CANCELLED && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-gray-500/10 border border-gray-500/20 flex items-center justify-center mx-auto mb-3">
                      <XCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 font-semibold">Request Cancelled</p>
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
                  {/* Timeline items with visual line */}
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-1 w-0.5 h-[calc(100%-8px)] bg-white/10" />

                    <div className="relative pb-4">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Created</span>
                        <span className="text-sm font-medium">{new Date(Number(loan.createdAt) * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {loan.activatedAt > BigInt(0) && (
                      <div className="relative pb-4">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Activated</span>
                          <span className="text-sm font-medium">{new Date(Number(loan.activatedAt) * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}

                    {loan.dueDate > BigInt(0) && (
                      <div className="relative pb-4">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Due Date</span>
                          <span className="text-sm font-medium">{new Date(Number(loan.dueDate) * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-gray-500/20 border-2 border-gray-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Duration</span>
                        <span className="text-sm font-medium">{formatDuration(loan.duration)}</span>
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
                    Collateral is held in escrow on-chain. The supplier provides fiat off-chain while the smart contract secures the crypto collateral.
                  </p>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Collateral Value</span>
                      <span className="text-sm font-bold text-green-400">${collateralUSD.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Fund Modal */}
      <Modal
        isOpen={showFundModal}
        onClose={() => setShowFundModal(false)}
        title="Fund Fiat Loan"
        size="md"
      >
        <div className="space-y-6">
          <div className="glass-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Fiat Amount to Provide</span>
              <span className="font-semibold text-green-400">
                {loan && formatCurrency(loan.fiatAmountCents, loan.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="font-semibold text-green-400">
                {loan && formatPercentage(loan.interestRate)} APY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-semibold">
                {loan && formatDuration(loan.duration)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collateral Securing Loan</span>
              <span className="font-semibold">
                {loan && formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
              </span>
            </div>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">Off-chain Fiat Transfer Required</p>
                <p className="text-gray-400 mt-1">
                  By accepting this loan, you agree to provide the fiat amount to the borrower off-chain.
                  The borrower&apos;s collateral is locked in the smart contract as security.
                </p>
              </div>
            </div>
          </div>

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

          <Button
            onClick={handleFund}
            loading={isFunding || acceptIsPending}
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isFunding || acceptIsPending}
          >
            Confirm Funding
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowFundModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Fiat Loan Request"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-red-400 font-medium">Confirm Cancellation</p>
                <p className="text-gray-400 mt-1">
                  Are you sure you want to cancel this fiat loan request?
                  Your collateral will be returned to your wallet.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleCancel}
            loading={isCancelling || cancelIsPending}
            variant="danger"
            className="w-full"
            disabled={isCancelling || cancelIsPending}
          >
            Confirm Cancel
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowCancelModal(false)}
            className="w-full"
          >
            Keep Request
          </Button>
        </div>
      </Modal>
    </div>
  );
}
