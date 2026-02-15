'use client';

import { Card } from '@/components/ui/Card';
import { Badge, LoanStatusBadge, RequestStatusBadge, HealthBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Loan, LoanRequest, LenderOffer, LoanStatus, LoanRequestStatus, getHealthStatus } from '@/types';
import { formatTokenAmount, formatPercentage, formatDuration, getTokenSymbol, getTokenDecimals, getHealthFactorColor, convertFiatToUSD } from '@/lib/utils';
import { useTokenPrice, useLTV } from '@/hooks/useContracts';
import { FiatLoan, FiatLoanStatus, FiatLenderOffer, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import { formatCurrency } from '@/hooks/useFiatOracle';
import { Clock, TrendingUp, Shield, ExternalLink, DollarSign, Banknote } from 'lucide-react';
import Link from 'next/link';

// Helper to format USD values
function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

interface LoanRequestCardProps {
  request: LoanRequest;
  onFund?: () => void;
  onCancel?: () => void;
  isOwner?: boolean;
  loading?: boolean;
}

export function LoanRequestCard({ request, onFund, onCancel, isOwner, loading }: LoanRequestCardProps) {
  const collateralSymbol = getTokenSymbol(request.collateralToken);
  const borrowSymbol = getTokenSymbol(request.borrowAsset);
  const collateralDecimals = getTokenDecimals(request.collateralToken);
  const borrowDecimals = getTokenDecimals(request.borrowAsset);

  // Get USD prices
  const { price: borrowPrice } = useTokenPrice(request.borrowAsset);
  const { price: collateralPrice } = useTokenPrice(request.collateralToken);

  // Calculate USD values
  const borrowUSD = borrowPrice
    ? (Number(request.borrowAmount) / Math.pow(10, Number(borrowDecimals))) * Number(borrowPrice) / 1e8
    : 0;
  const collateralUSD = collateralPrice
    ? (Number(request.collateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // Get LTV from contract (duration is in seconds, convert to days)
  const durationDays = Math.ceil(Number(request.duration) / (24 * 60 * 60));
  const { data: ltvBps } = useLTV(request.collateralToken, durationDays);

  // LTV from contract is in basis points (10000 = 100%)
  const ltv = ltvBps ? Number(ltvBps) / 100 : 0;

  return (
    <Card hover className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">
              {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
            </span>
          </div>
          {borrowUSD > 0 && (
            <p className="text-sm text-primary-400 font-medium">
              {formatUSD(borrowUSD)}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Collateral: {formatTokenAmount(request.collateralAmount, collateralDecimals)} {collateralSymbol}
            {collateralUSD > 0 && (
              <span className="text-gray-500"> ({formatUSD(collateralUSD)})</span>
            )}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-medium">{formatPercentage(request.interestRate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <div>
            <p className="text-xs text-gray-400">Duration</p>
            <p className="font-medium">{formatDuration(request.duration)}</p>
          </div>
        </div>
      </div>

      {/* LTV Display */}
      {ltv > 0 && (
        <div className="flex items-center justify-between mb-3 px-2 py-1.5 bg-white/5 rounded-lg">
          <span className="text-xs text-gray-400">LTV Ratio</span>
          <span className={`text-sm font-medium ${ltv > 80 ? 'text-red-400' : ltv > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
            {ltv.toFixed(1)}%
          </span>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        {request.status === LoanRequestStatus.PENDING && !isOwner && onFund && (
          <Button onClick={onFund} loading={loading} className="flex-1">
            Fund Request
          </Button>
        )}
        {request.status === LoanRequestStatus.PENDING && isOwner && onCancel && (
          <Button variant="danger" onClick={onCancel} loading={loading} className="flex-1">
            Cancel
          </Button>
        )}
        <Link href={`/loan/${request.requestId}`} className="flex-1">
          <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
            Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}

interface LenderOfferCardProps {
  offer: LenderOffer;
  onAccept?: () => void;
  onCancel?: () => void;
  isOwner?: boolean;
  loading?: boolean;
}

export function LenderOfferCard({ offer, onAccept, onCancel, isOwner, loading }: LenderOfferCardProps) {
  const lendSymbol = getTokenSymbol(offer.lendAsset);
  const lendDecimals = getTokenDecimals(offer.lendAsset);

  // Check if collateral is "any" (zero address means borrower chooses)
  const isAnyCollateral = offer.requiredCollateralAsset === '0x0000000000000000000000000000000000000000';
  const collateralSymbol = isAnyCollateral ? 'Any' : getTokenSymbol(offer.requiredCollateralAsset);
  const collateralDecimals = isAnyCollateral ? 18 : getTokenDecimals(offer.requiredCollateralAsset);

  // Get USD prices
  const { price: lendPrice } = useTokenPrice(offer.lendAsset);
  const { price: collateralPrice } = useTokenPrice(isAnyCollateral ? undefined : offer.requiredCollateralAsset);

  // Calculate USD values
  const lendUSD = lendPrice
    ? (Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals))) * Number(lendPrice) / 1e8
    : 0;
  const collateralUSD = !isAnyCollateral && collateralPrice
    ? (Number(offer.minCollateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // Get LTV from contract (duration is in seconds, convert to days) - skip for "any" collateral
  const durationDays = Math.ceil(Number(offer.duration) / (24 * 60 * 60));
  const { data: ltvBps } = useLTV(isAnyCollateral ? undefined : offer.requiredCollateralAsset, durationDays);

  // LTV from contract is in basis points (10000 = 100%)
  const ltv = ltvBps ? Number(ltvBps) / 100 : 0;

  return (
    <Card hover className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">
              {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
            </span>
            <Badge variant="info" size="sm">Offer</Badge>
          </div>
          {lendUSD > 0 && (
            <p className="text-sm text-accent-400 font-medium">
              {formatUSD(lendUSD)}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {isAnyCollateral ? (
              <span className="text-accent-400">Collateral: Borrower chooses</span>
            ) : (
              <>
                Min Collateral: {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                {collateralUSD > 0 && (
                  <span className="text-gray-500"> ({formatUSD(collateralUSD)})</span>
                )}
              </>
            )}
          </p>
        </div>
        <RequestStatusBadge status={offer.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-medium">{formatPercentage(offer.interestRate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <div>
            <p className="text-xs text-gray-400">Duration</p>
            <p className="font-medium">{formatDuration(offer.duration)}</p>
          </div>
        </div>
      </div>

      {/* LTV Display - only show if specific collateral is required */}
      {!isAnyCollateral && ltv > 0 && (
        <div className="flex items-center justify-between mb-3 px-2 py-1.5 bg-white/5 rounded-lg">
          <span className="text-xs text-gray-400">LTV Ratio</span>
          <span className={`text-sm font-medium ${ltv > 80 ? 'text-red-400' : ltv > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
            {ltv.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Show info for "any collateral" offers */}
      {isAnyCollateral && (
        <div className="flex items-center justify-between mb-3 px-2 py-1.5 bg-accent-500/10 rounded-lg border border-accent-500/20">
          <span className="text-xs text-gray-400">Collateral Type</span>
          <span className="text-sm font-medium text-accent-400">Flexible</span>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        {offer.status === LoanRequestStatus.PENDING && !isOwner && onAccept && (
          <Button onClick={onAccept} loading={loading} className="flex-1">
            Accept Offer
          </Button>
        )}
        {offer.status === LoanRequestStatus.PENDING && isOwner && onCancel && (
          <Button variant="danger" onClick={onCancel} loading={loading} className="flex-1">
            Cancel
          </Button>
        )}
        <Link href={`/offer/${offer.offerId}`} className="flex-1">
          <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
            Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}

interface ActiveLoanCardProps {
  loan: Loan;
  healthFactor?: bigint;
  isLoadingHealth?: boolean;
  repaymentAmount?: bigint;
  onRepay?: () => void;
  onLiquidate?: () => void;
  isBorrower?: boolean;
  loading?: boolean;
}

export function ActiveLoanCard({
  loan,
  healthFactor,
  isLoadingHealth,
  repaymentAmount,
  onRepay,
  onLiquidate,
  isBorrower,
  loading
}: ActiveLoanCardProps) {
  const collateralSymbol = getTokenSymbol(loan.collateralAsset);
  const borrowSymbol = getTokenSymbol(loan.borrowAsset);
  const collateralDecimals = getTokenDecimals(loan.collateralAsset);
  const borrowDecimals = getTokenDecimals(loan.borrowAsset);

  // Get USD prices
  const { price: borrowPrice } = useTokenPrice(loan.borrowAsset);
  const { price: collateralPrice } = useTokenPrice(loan.collateralAsset);

  const healthStatus = healthFactor ? getHealthStatus(healthFactor) : undefined;
  const healthFactorDisplay = isLoadingHealth ? 'Loading...' : healthFactor ? (Number(healthFactor) / 100).toFixed(2) : '--';
  const remainingCollateral = loan.collateralAmount - loan.collateralReleased;

  // Calculate USD values
  const principalUSD = borrowPrice
    ? (Number(loan.principalAmount) / Math.pow(10, Number(borrowDecimals))) * Number(borrowPrice) / 1e8
    : 0;
  const collateralUSD = collateralPrice
    ? (Number(remainingCollateral) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;
  const repaymentUSD = repaymentAmount && borrowPrice
    ? (Number(repaymentAmount) / Math.pow(10, Number(borrowDecimals))) * Number(borrowPrice) / 1e8
    : 0;

  return (
    <Card hover className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">
              Loan #{loan.loanId.toString()}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {isBorrower ? 'You borrowed' : 'You lent'}{' '}
            {formatTokenAmount(loan.principalAmount, borrowDecimals)} {borrowSymbol}
            {principalUSD > 0 && (
              <span className="text-primary-400 ml-1">({formatUSD(principalUSD)})</span>
            )}
          </p>
        </div>
        <LoanStatusBadge status={loan.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent-400" />
          <div>
            <p className="text-xs text-gray-400">Collateral</p>
            <p className="font-medium">
              {formatTokenAmount(remainingCollateral, collateralDecimals)} {collateralSymbol}
            </p>
            {collateralUSD > 0 && (
              <p className="text-xs text-gray-500">{formatUSD(collateralUSD)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-medium">{formatPercentage(loan.interestRate)}</p>
          </div>
        </div>
      </div>

      {loan.status === LoanStatus.ACTIVE && (
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Health Factor</span>
            {isLoadingHealth ? (
              <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
            ) : healthStatus ? (
              <HealthBadge status={healthStatus} value={healthFactorDisplay} />
            ) : (
              <span className="text-xs text-gray-500">--</span>
            )}
          </div>
          {repaymentAmount && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total Debt</span>
              <div className="text-right">
                <span className={`font-medium ${getHealthFactorColor(healthFactor || BigInt(0))}`}>
                  {formatTokenAmount(repaymentAmount, borrowDecimals)} {borrowSymbol}
                </span>
                {repaymentUSD > 0 && (
                  <p className="text-xs text-gray-500">{formatUSD(repaymentUSD)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-gray-400 mb-4">
        Due: {new Date(Number(loan.dueDate) * 1000).toLocaleDateString()}
      </div>

      <div className="mt-auto flex gap-2">
        {loan.status === LoanStatus.ACTIVE && isBorrower && onRepay && (
          <Button onClick={onRepay} loading={loading} className="flex-1">
            Repay
          </Button>
        )}
        {loan.status === LoanStatus.ACTIVE && !isBorrower && healthStatus === 'liquidatable' && onLiquidate && (
          <Button variant="danger" onClick={onLiquidate} loading={loading} className="flex-1">
            Liquidate
          </Button>
        )}
        <Link href={`/loan/active/${loan.loanId}`} className="flex-1">
          <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
            Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// Fiat Loan Request Card
interface FiatLoanRequestCardProps {
  loan: FiatLoan;
  onFund?: () => void;
  onCancel?: () => void;
  isOwner?: boolean;
  isSupplier?: boolean;
  loading?: boolean;
}

export function FiatLoanRequestCard({ loan, onFund, onCancel, isOwner, isSupplier, loading }: FiatLoanRequestCardProps) {
  const collateralSymbol = getTokenSymbol(loan.collateralAsset);
  const collateralDecimals = getTokenDecimals(loan.collateralAsset);

  // Get USD price for collateral
  const { price: collateralPrice } = useTokenPrice(loan.collateralAsset);

  // Calculate USD values
  // const fiatAmount = Number(loan.fiatAmountCents) / 100;
  const fiatAmountUSD = convertFiatToUSD(loan.fiatAmountCents, loan.currency, loan.exchangeRateAtCreation);
  const collateralUSD = collateralPrice
    ? (Number(loan.collateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // Get LTV from contract (duration is in seconds, convert to days)
  const durationDays = Math.ceil(Number(loan.duration) / (24 * 60 * 60));
  const { data: ltvBps } = useLTV(loan.collateralAsset, durationDays);

  // LTV from contract is in basis points (10000 = 100%)
  const ltv = ltvBps ? Number(ltvBps) / 100 : 0;

  // Status badge color
  const getStatusBadge = () => {
    switch (loan.status) {
      case FiatLoanStatus.PENDING_SUPPLIER:
        return <Badge variant="warning" size="sm">Pending</Badge>;
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
  };

  return (
    <Card hover className="flex flex-col h-full border-green-500/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-lg font-bold text-green-400">
              {formatCurrency(loan.fiatAmountCents, loan.currency)}
            </span>
          </div>
          {loan.currency !== 'USD' && fiatAmountUSD > 0 && (
            <p className="text-sm text-gray-400">
              ≈ {formatUSD(fiatAmountUSD)}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Collateral: {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
            {collateralUSD > 0 && (
              <span className="text-gray-500"> ({formatUSD(collateralUSD)})</span>
            )}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-medium">{formatPercentage(loan.interestRate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <div>
            <p className="text-xs text-gray-400">Duration</p>
            <p className="font-medium">{formatDuration(loan.duration)}</p>
          </div>
        </div>
      </div>

      {/* LTV Display */}
      {ltv > 0 && (
        <div className="flex items-center justify-between mb-3 px-2 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
          <span className="text-xs text-gray-400">LTV Ratio</span>
          <span className={`text-sm font-medium ${ltv > 80 ? 'text-red-400' : ltv > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
            {ltv.toFixed(1)}%
          </span>
        </div>
      )}

      {loan.status === FiatLoanStatus.ACTIVE && loan.dueDate > BigInt(0) && (
        <div className="text-sm text-gray-400 mb-4">
          Due: {new Date(Number(loan.dueDate) * 1000).toLocaleDateString()}
        </div>
      )}

      <div className="mt-auto flex gap-2">
        {loan.status === FiatLoanStatus.PENDING_SUPPLIER && !isOwner && isSupplier && onFund && (
          <Button onClick={onFund} loading={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            Fund Request
          </Button>
        )}
        {loan.status === FiatLoanStatus.PENDING_SUPPLIER && isOwner && onCancel && (
          <Button variant="danger" onClick={onCancel} loading={loading} className="flex-1">
            Cancel
          </Button>
        )}
        <Link href={`/fiat-loan/${loan.loanId}`} className="flex-1">
          <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
            Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// Fiat Lender Offer Card
interface FiatLenderOfferCardProps {
  offer: FiatLenderOffer;
  onAccept?: () => void;
  onCancel?: () => void;
  isOwner?: boolean;
  loading?: boolean;
}

export function FiatLenderOfferCard({ offer, onAccept, onCancel, isOwner, loading }: FiatLenderOfferCardProps) {
  // Convert fiat amount to display value
  const minCollateralUSD = Number(offer.minCollateralValueUSD);
  const fiatAmountUSD = convertFiatToUSD(offer.fiatAmountCents, offer.currency, offer.exchangeRateAtCreation);

  // Get status badge
  const getStatusBadge = () => {
    switch (offer.status) {
      case FiatLenderOfferStatus.ACTIVE:
        return <Badge variant="success" size="sm">Active</Badge>;
      case FiatLenderOfferStatus.ACCEPTED:
        return <Badge variant="info" size="sm">Accepted</Badge>;
      case FiatLenderOfferStatus.CANCELLED:
        return <Badge variant="default" size="sm">Cancelled</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card hover className="flex flex-col h-full border-green-500/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-5 h-5 text-green-400" />
            <span className="text-lg font-bold text-green-400">
              {formatCurrency(offer.fiatAmountCents, offer.currency)}
            </span>
            <Badge variant="info" size="sm">Offer</Badge>
          </div>
          {offer.currency !== 'USD' && fiatAmountUSD > 0 && (
            <p className="text-sm text-gray-400">
              ≈ {formatUSD(fiatAmountUSD)}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Min Collateral Value: {formatUSD(minCollateralUSD)}
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">Interest Rate</p>
            <p className="font-medium">{formatPercentage(offer.interestRate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <div>
            <p className="text-xs text-gray-400">Duration</p>
            <p className="font-medium">{formatDuration(offer.duration)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        {offer.status === FiatLenderOfferStatus.ACTIVE && !isOwner && onAccept && (
          <Button onClick={onAccept} loading={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            Accept Offer
          </Button>
        )}
        {offer.status === FiatLenderOfferStatus.ACTIVE && isOwner && onCancel && (
          <Button variant="danger" onClick={onCancel} loading={loading} className="flex-1">
            Cancel
          </Button>
        )}
        <Link href={`/fiat-offer/${offer.offerId}`} className="flex-1">
          <Button variant="secondary" className="w-full" icon={<ExternalLink className="w-4 h-4" />}>
            Details
          </Button>
        </Link>
      </div>
    </Card>
  );
}
