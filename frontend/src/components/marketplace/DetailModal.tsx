'use client';

import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Shield, TrendingUp, ArrowRight, Wallet, DollarSign } from 'lucide-react';
import { LoanRequest, LenderOffer } from '@/types';
import { FiatLoan, FiatLenderOffer } from '@/hooks/useFiatLoan';
import { formatTokenAmount, formatPercentage, formatDuration, formatTimeUntil, getTokenSymbol, getTokenDecimals, convertFiatToUSD } from '@/lib/utils';
import { useTokenPrice } from '@/hooks/useContracts';
import { formatCurrency } from '@/hooks/useFiatOracle';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Helper to format USD values
function formatUSD(amount: number): string {
  if (amount < 0.01) return '<$0.01';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1000000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1000000).toFixed(2)}M`;
}

// Calculate repayment amount
function calculateRepayment(principal: number, interestRateBps: bigint, durationSeconds: bigint): number {
  const interestRate = Number(interestRateBps) / 10000;
  const durationDays = Number(durationSeconds) / 86400;
  const dailyInterest = interestRate / 365;
  return principal * (1 + dailyInterest * durationDays);
}

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}

function BaseModal({ isOpen, onClose, children, title }: BaseModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 overflow-hidden"
          >
            <div className="glass-card h-full rounded-2xl border border-white/10 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface CryptoBorrowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LoanRequest;
}

export function CryptoBorrowRequestModal({ isOpen, onClose, request }: CryptoBorrowRequestModalProps) {
  const collateralSymbol = getTokenSymbol(request.collateralToken);
  const borrowSymbol = getTokenSymbol(request.borrowAsset);
  const collateralDecimals = getTokenDecimals(request.collateralToken);
  const borrowDecimals = getTokenDecimals(request.borrowAsset);

  const { price: borrowPrice } = useTokenPrice(request.borrowAsset);
  const { price: collateralPrice } = useTokenPrice(request.collateralToken);

  const borrowAmount = Number(request.borrowAmount) / Math.pow(10, Number(borrowDecimals));
  const borrowUSD = borrowPrice ? borrowAmount * Number(borrowPrice) / 1e8 : 0;

  const collateralAmount = Number(request.collateralAmount) / Math.pow(10, Number(collateralDecimals));
  const collateralUSD = collateralPrice ? collateralAmount * Number(collateralPrice) / 1e8 : 0;

  const repaymentAmount = calculateRepayment(borrowAmount, request.interestRate, request.duration);
  const repaymentUSD = borrowPrice ? repaymentAmount * Number(borrowPrice) / 1e8 : 0;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Borrow Request Details">
      <div className="space-y-6">
        {/* Main Amount */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">Borrower wants</p>
          <div className="text-3xl font-bold text-white">
            {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
          </div>
          {borrowUSD > 0 && (
            <p className="text-lg text-primary-400 mt-1">{formatUSD(borrowUSD)}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          <DetailRow
            icon={<Shield className="w-5 h-5 text-accent-400" />}
            label="Collateral"
            value={`${formatTokenAmount(request.collateralAmount, collateralDecimals)} ${collateralSymbol}`}
            subValue={collateralUSD > 0 ? formatUSD(collateralUSD) : undefined}
          />
          <DetailRow
            icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
            label="Interest Rate"
            value={formatPercentage(request.interestRate)}
            highlight
          />
          <DetailRow
            icon={<Clock className="w-5 h-5 text-primary-400" />}
            label="Duration"
            value={formatDuration(request.duration)}
          />
          <DetailRow
            icon={<DollarSign className="w-5 h-5 text-green-400" />}
            label="Total Repayment"
            value={`${repaymentAmount.toFixed(4)} ${borrowSymbol}`}
            subValue={repaymentUSD > 0 ? formatUSD(repaymentUSD) : undefined}
          />
        </div>

        {/* Expiry */}
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <p className="text-sm text-gray-400">Expires {formatTimeUntil(request.expireAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/loan/${request.requestId}`} className="flex-1">
            <Button variant="primary" className="w-full" size="lg">
              Fund Request
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </BaseModal>
  );
}

interface CryptoLendingOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: LenderOffer;
}

export function CryptoLendingOfferModal({ isOpen, onClose, offer }: CryptoLendingOfferModalProps) {
  const lendSymbol = getTokenSymbol(offer.lendAsset);
  const lendDecimals = getTokenDecimals(offer.lendAsset);
  const isAnyCollateral = offer.requiredCollateralAsset === '0x0000000000000000000000000000000000000000';
  const collateralSymbol = isAnyCollateral ? 'Any' : getTokenSymbol(offer.requiredCollateralAsset);
  const collateralDecimals = isAnyCollateral ? 18 : getTokenDecimals(offer.requiredCollateralAsset);

  const { price: lendPrice } = useTokenPrice(offer.lendAsset);
  const { price: collateralPrice } = useTokenPrice(isAnyCollateral ? undefined : offer.requiredCollateralAsset);

  const lendAmount = Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals));
  const lendUSD = lendPrice ? lendAmount * Number(lendPrice) / 1e8 : 0;

  const minCollateralAmount = Number(offer.minCollateralAmount) / Math.pow(10, Number(collateralDecimals));
  const collateralUSD = !isAnyCollateral && collateralPrice ? minCollateralAmount * Number(collateralPrice) / 1e8 : 0;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Lending Offer Details">
      <div className="space-y-6">
        {/* Main Amount */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">Available to lend</p>
          <div className="text-3xl font-bold text-white">
            {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
          </div>
          {lendUSD > 0 && (
            <p className="text-lg text-accent-400 mt-1">{formatUSD(lendUSD)}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          {!isAnyCollateral ? (
            <DetailRow
              icon={<Wallet className="w-5 h-5 text-primary-400" />}
              label="Min Collateral Required"
              value={`${formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} ${collateralSymbol}`}
              subValue={collateralUSD > 0 ? formatUSD(collateralUSD) : undefined}
            />
          ) : (
            <div className="p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-accent-400" />
                <div>
                  <p className="text-sm text-gray-400">Collateral Type</p>
                  <p className="font-medium text-accent-400">Flexible - Borrower chooses</p>
                </div>
              </div>
            </div>
          )}
          <DetailRow
            icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
            label="Interest Rate"
            value={formatPercentage(offer.interestRate)}
            highlight
          />
          <DetailRow
            icon={<Clock className="w-5 h-5 text-primary-400" />}
            label="Duration"
            value={formatDuration(offer.duration)}
          />
        </div>

        {/* Expiry */}
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <p className="text-sm text-gray-400">Expires {formatTimeUntil(offer.expireAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/offer/${offer.offerId}`} className="flex-1">
            <Button variant="accent" className="w-full" size="lg">
              Accept Offer
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </BaseModal>
  );
}

interface FiatBorrowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: FiatLoan;
}

export function FiatBorrowRequestModal({ isOpen, onClose, loan }: FiatBorrowRequestModalProps) {
  const collateralSymbol = getTokenSymbol(loan.collateralAsset);
  const collateralDecimals = getTokenDecimals(loan.collateralAsset);

  const { price: collateralPrice } = useTokenPrice(loan.collateralAsset);

  const fiatAmount = Number(loan.fiatAmountCents) / 100;
  const fiatAmountUSD = convertFiatToUSD(loan.fiatAmountCents, loan.currency, loan.exchangeRateAtCreation);

  const collateralAmount = Number(loan.collateralAmount) / Math.pow(10, Number(collateralDecimals));
  const collateralUSD = collateralPrice ? collateralAmount * Number(collateralPrice) / 1e8 : 0;

  const repaymentAmount = calculateRepayment(fiatAmount, loan.interestRate, loan.duration);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Fiat Borrow Request Details">
      <div className="space-y-6">
        {/* Main Amount */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">Borrower wants</p>
          <div className="text-3xl font-bold text-green-400">
            {formatCurrency(loan.fiatAmountCents, loan.currency)}
          </div>
          {loan.currency !== 'USD' && fiatAmountUSD > 0 && (
            <p className="text-lg text-gray-400 mt-1">~ {formatUSD(fiatAmountUSD)}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          <DetailRow
            icon={<Shield className="w-5 h-5 text-green-400" />}
            label="Collateral"
            value={`${formatTokenAmount(loan.collateralAmount, collateralDecimals)} ${collateralSymbol}`}
            subValue={collateralUSD > 0 ? formatUSD(collateralUSD) : undefined}
          />
          <DetailRow
            icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
            label="Interest Rate"
            value={formatPercentage(loan.interestRate)}
            highlight
          />
          <DetailRow
            icon={<Clock className="w-5 h-5 text-primary-400" />}
            label="Duration"
            value={formatDuration(loan.duration)}
          />
          <DetailRow
            icon={<DollarSign className="w-5 h-5 text-green-400" />}
            label="Total Repayment"
            value={`${loan.currency === 'NGN' ? '₦' : '$'}${repaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/fiat-loan/${loan.loanId}`} className="flex-1">
            <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
              Fund Request
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </BaseModal>
  );
}

interface FiatLendingOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: FiatLenderOffer;
}

export function FiatLendingOfferModal({ isOpen, onClose, offer }: FiatLendingOfferModalProps) {
  const fiatAmountUSD = convertFiatToUSD(offer.fiatAmountCents, offer.currency, offer.exchangeRateAtCreation);
  const minCollateralUSD = Number(offer.minCollateralValueUSD);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Fiat Lending Offer Details">
      <div className="space-y-6">
        {/* Main Amount */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">Available to lend</p>
          <div className="text-3xl font-bold text-green-400">
            {formatCurrency(offer.fiatAmountCents, offer.currency)}
          </div>
          {offer.currency !== 'USD' && fiatAmountUSD > 0 && (
            <p className="text-lg text-gray-400 mt-1">~ {formatUSD(fiatAmountUSD)}</p>
          )}
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          <DetailRow
            icon={<Wallet className="w-5 h-5 text-green-400" />}
            label="Min Collateral Value"
            value={formatUSD(minCollateralUSD)}
          />
          <DetailRow
            icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
            label="Interest Rate"
            value={formatPercentage(offer.interestRate)}
            highlight
          />
          <DetailRow
            icon={<Clock className="w-5 h-5 text-primary-400" />}
            label="Duration"
            value={formatDuration(offer.duration)}
          />
        </div>

        {/* Expiry */}
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <p className="text-sm text-gray-400">Expires {formatTimeUntil(offer.expireAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/fiat-offer/${offer.offerId}`} className="flex-1">
            <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
              Accept Offer
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </BaseModal>
  );
}

// Helper component for detail rows
function DetailRow({
  icon,
  label,
  value,
  subValue,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
      {icon}
      <div className="flex-1">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`font-semibold ${highlight ? 'text-orange-400' : 'text-white'}`}>{value}</p>
        {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
      </div>
    </div>
  );
}
