'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  useFiatLoan,
  useFiatLoanTotalDebt,
  useFiatLoanHealthFactor,
  useAcceptFiatLoanRequest,
  useCancelFiatLoanRequest,
  FiatLoanStatus,
} from '@/hooks/useFiatLoan';
import { useTokenPrice } from '@/hooks/useContracts';
import { formatCurrency } from '@/hooks/useFiatOracle';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
  formatTimeUntil,
  getTokenSymbol,
  getTokenDecimals,
  getHealthFactorColor,
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
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN } from '@/config/contracts';
import { Address } from 'viem';

// Status badge component
function FiatLoanStatusBadge({ status }: { status: FiatLoanStatus }) {
  switch (status) {
    case FiatLoanStatus.PENDING_SUPPLIER:
      return <Badge variant="warning" size="sm">Pending Supplier</Badge>;
    case FiatLoanStatus.ACTIVE:
      return <Badge variant="success" size="sm">Active</Badge>;
    case FiatLoanStatus.REPAID:
      return <Badge variant="info" size="sm">Repaid</Badge>;
    case FiatLoanStatus.LIQUIDATED:
      return <Badge variant="danger" size="sm">Liquidated</Badge>;
    case FiatLoanStatus.CANCELLED:
      return <Badge variant="default" size="sm">Cancelled</Badge>;
    default:
      return null;
  }
}

export default function FiatLoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showFundModal, setShowFundModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch fiat loan data
  const { data: loanData, isLoading: loanLoading, refetch } = useFiatLoan(loanId);

  // Parse loan data from contract
  const loanTuple = loanData as readonly unknown[];
  const loan = loanData ? {
    loanId: loanTuple[0] as bigint,
    borrower: loanTuple[1] as Address,
    supplier: loanTuple[2] as Address,
    collateralAsset: loanTuple[3] as Address,
    collateralAmount: loanTuple[4] as bigint,
    fiatAmountCents: loanTuple[5] as bigint,
    currency: loanTuple[6] as string,
    interestRate: loanTuple[7] as bigint,
    duration: loanTuple[8] as bigint,
    status: Number(loanTuple[9]) as FiatLoanStatus,
    createdAt: loanTuple[10] as bigint,
    activatedAt: loanTuple[11] as bigint,
    dueDate: loanTuple[12] as bigint,
    gracePeriodEnd: loanTuple[13] as bigint,
    claimableAmountCents: loanTuple[14] as bigint,
    fundsWithdrawn: loanTuple[15] as boolean,
    repaymentDepositId: loanTuple[16] as `0x${string}`,
    exchangeRateAtCreation: (loanTuple[17] as bigint) || BigInt(0),
  } : null;

  // Get total debt and health factor for active loans
  const { data: totalDebt } = useFiatLoanTotalDebt(
    loan?.status === FiatLoanStatus.ACTIVE ? loanId : undefined
  );
  const { data: healthFactor, isLoading: isLoadingHealth } = useFiatLoanHealthFactor(
    loan?.status === FiatLoanStatus.ACTIVE ? loanId : undefined
  );

  // Token info
  const collateralSymbol = loan ? getTokenSymbol(loan.collateralAsset) : '';
  const collateralDecimals = loan ? Number(getTokenDecimals(loan.collateralAsset)) : 18;

  // Check if user is the borrower or supplier
  const isBorrower = loan && address?.toLowerCase() === loan.borrower.toLowerCase();
  const isSupplier = loan && address?.toLowerCase() === loan.supplier.toLowerCase();

  // Price data for USD values
  const collateralPriceHook = useTokenPrice(loan?.collateralAsset);
  const collateralPrice = collateralPriceHook.price;

  // Calculate USD values
  const collateralUSD = loan && collateralPrice
    ? (Number(loan.collateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // Fiat amount
  // const fiatAmount = loan ? Number(loan.fiatAmountCents) / 100 : 0;

  // Write hooks
  const { acceptFiatLoanRequest, isPending: acceptIsPending, isSuccess: acceptSuccess } = useAcceptFiatLoanRequest();
  const { cancelFiatLoanRequest, isPending: cancelIsPending, isSuccess: cancelSuccess } = useCancelFiatLoanRequest();

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

  const handleFund = async () => {
    if (!loan || !loanId) return;
    setIsFunding(true);

    try {
      await acceptFiatLoanRequest(loanId);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fund fiat loan';
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

  // Format health factor
  const healthFactorValue = healthFactor ? Number(healthFactor as bigint) / 100 : 0;
  const healthFactorDisplay = isLoadingHealth ? 'Loading...' : healthFactorValue.toFixed(2);

  // Format total debt
  const totalDebtCents = totalDebt ? Number(totalDebt as bigint) : 0;
  const totalDebtDisplay = totalDebtCents / 100;

  if (loanLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  // Status 0 from an unfilled/invalid slot will have empty borrower
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

  // Expiration for pending loans (7 days from creation)
  const expiresAt = Number(loan.createdAt) + (7 * 24 * 60 * 60);
  const isExpired = loan.status === FiatLoanStatus.PENDING_SUPPLIER && Date.now() / 1000 > expiresAt;
  const canFund = loan.status === FiatLoanStatus.PENDING_SUPPLIER && !isBorrower && !isExpired && isConnected;
  const canCancel = loan.status === FiatLoanStatus.PENDING_SUPPLIER && isBorrower;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Banknote className="w-8 h-8 text-green-400" />
              <h1 className="text-3xl font-bold">Fiat Loan #{loan.loanId.toString()}</h1>
              <FiatLoanStatusBadge status={loan.status} />
            </div>
            <p className="text-gray-400">
              {isBorrower ? 'Your fiat loan request for' : isSupplier ? 'You funded' : 'Borrower requesting'}{' '}
              <span className="text-green-400 font-medium">
                {formatCurrency(loan.fiatAmountCents, loan.currency)}
              </span>
            </p>
          </div>

          <div className="flex gap-3">
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
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-green-500/20">
                <h2 className="text-xl font-bold mb-6">Loan Details</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Fiat Amount</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(loan.fiatAmountCents, loan.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Interest Rate</p>
                      <p className="text-lg font-semibold text-green-400">
                        {formatPercentage(loan.interestRate)} APY
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-lg font-semibold">
                        {formatDuration(loan.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Collateral Locked</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
                      </p>
                      {collateralUSD > 0 && (
                        <p className="text-sm text-gray-500">~${collateralUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Currency</p>
                      <p className="text-lg font-semibold">{loan.currency}</p>
                    </div>
                    {loan.exchangeRateAtCreation > BigInt(0) && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Exchange Rate at Creation</p>
                        <p className="text-lg font-semibold">
                          {(Number(loan.exchangeRateAtCreation) / 1e8).toFixed(4)} {loan.currency}/USD
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Health & Debt Info for Active Loans */}
            {loan.status === FiatLoanStatus.ACTIVE && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="border-green-500/20">
                  <h2 className="text-xl font-bold mb-6">Loan Health</h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-accent-400" />
                        <p className="text-sm text-gray-400">Health Factor</p>
                      </div>
                      <p className={`text-2xl font-bold ${getHealthFactorColor(BigInt(Math.floor(healthFactorValue * 100)))}`}>
                        {healthFactorDisplay}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {healthFactorValue >= 1.5 ? 'Healthy' : healthFactorValue >= 1.0 ? 'Warning' : 'At Risk'}
                      </p>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <p className="text-sm text-gray-400">Total Debt</p>
                      </div>
                      <p className="text-2xl font-bold text-green-400">
                        ${totalDebtDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loan.currency}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Principal + Accrued Interest
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Participants */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-green-500/20">
                <h2 className="text-xl font-bold mb-6">Participants</h2>
                <div className="space-y-4">
                  {/* Borrower */}
                  <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Borrower</p>
                        <p className="font-mono">{formatAddress(loan.borrower, 6)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isBorrower && <Badge variant="info" size="sm">You</Badge>}
                      <button onClick={() => copyAddress(loan.borrower)} className="p-2 hover:bg-white/10 rounded-lg">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.borrower}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Supplier (only show if funded) */}
                  {loan.supplier && loan.supplier !== '0x0000000000000000000000000000000000000000' && (
                    <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Banknote className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Supplier</p>
                          <p className="font-mono">{formatAddress(loan.supplier, 6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSupplier && <Badge variant="success" size="sm">You</Badge>}
                        <button onClick={() => copyAddress(loan.supplier)} className="p-2 hover:bg-white/10 rounded-lg">
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.supplier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-white/10 rounded-lg"
                        >
                          <ExternalLink className="w-4 h-4" />
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
                transition={{ delay: 0.3 }}
              >
                <Card className="border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold">Funding Opportunity</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">You Provide (Fiat)</span>
                      <span className="font-medium text-green-400">
                        {formatCurrency(loan.fiatAmountCents, loan.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Interest Rate</span>
                      <span className="font-medium text-green-400">
                        {formatPercentage(loan.interestRate)} APY
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Collateral Securing Loan</span>
                      <span className="font-medium">
                        {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
                        {collateralUSD > 0 && (
                          <span className="text-gray-500 text-sm ml-1">(~${collateralUSD.toFixed(2)})</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Loan Duration</span>
                      <span className="font-medium">
                        {formatDuration(loan.duration)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-gray-400">
                      As a supplier, you will provide fiat currency to the borrower off-chain.
                      The borrower&apos;s crypto collateral is locked in the smart contract as security.
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-green-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold">Timeline</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created</span>
                    <span>{new Date(Number(loan.createdAt) * 1000).toLocaleDateString()}</span>
                  </div>
                  {loan.status === FiatLoanStatus.PENDING_SUPPLIER && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expires</span>
                      <span className={isExpired ? 'text-red-400' : ''}>
                        {isExpired ? 'Expired' : formatTimeUntil(BigInt(expiresAt))}
                      </span>
                    </div>
                  )}
                  {loan.activatedAt > BigInt(0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Activated</span>
                      <span>{new Date(Number(loan.activatedAt) * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                  {loan.dueDate > BigInt(0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Due Date</span>
                      <span>{new Date(Number(loan.dueDate) * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loan Duration</span>
                    <span>{formatDuration(loan.duration)}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-green-500/20">
                <h3 className="font-semibold mb-4">Status</h3>
                <div className="space-y-3">
                  {loan.status === FiatLoanStatus.PENDING_SUPPLIER && !isExpired && (
                    <div className="text-center py-4">
                      <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                      <p className="text-yellow-400 font-semibold">Awaiting Supplier</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Waiting for a fiat supplier to fund this loan
                      </p>
                    </div>
                  )}

                  {loan.status === FiatLoanStatus.PENDING_SUPPLIER && isExpired && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Request Expired</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This request can no longer be funded
                      </p>
                    </div>
                  )}

                  {loan.status === FiatLoanStatus.ACTIVE && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-semibold">Loan Active</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan is currently active
                      </p>
                    </div>
                  )}

                  {loan.status === FiatLoanStatus.REPAID && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                      <p className="text-blue-400 font-semibold">Loan Repaid</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan has been fully repaid
                      </p>
                    </div>
                  )}

                  {loan.status === FiatLoanStatus.LIQUIDATED && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">Loan Liquidated</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Collateral was liquidated due to undercollateralization
                      </p>
                    </div>
                  )}

                  {loan.status === FiatLoanStatus.CANCELLED && (
                    <div className="text-center py-4">
                      <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400 font-semibold">Request Cancelled</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Security Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="border-green-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-accent-400" />
                  <h3 className="font-semibold">Security</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>
                    Collateral is held in escrow on-chain. The supplier provides fiat off-chain while the smart contract secures the crypto collateral.
                  </p>
                  <p className="text-green-400 font-medium">
                    Collateral Value: ${collateralUSD.toFixed(2)}
                  </p>
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
          {/* Summary */}
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
