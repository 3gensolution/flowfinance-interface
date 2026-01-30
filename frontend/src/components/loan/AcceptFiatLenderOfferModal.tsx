'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Address, parseUnits, formatUnits } from 'viem';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import { FiatLenderOffer } from '@/hooks/useFiatLoan';
import { useTokenBalance, useTokenAllowance, useApproveToken, useTokenPrice, useSupportedAssets } from '@/hooks/useContracts';
import { useAcceptFiatLenderOffer } from '@/hooks/useFiatLoan';
import { formatCurrency, convertToUSDCents, useBatchExchangeRates } from '@/hooks/useFiatOracle';
import { formatTokenAmount, getTokenDecimals } from '@/lib/utils';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AcceptFiatLenderOfferModalProps {
  offer: FiatLenderOffer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AcceptFiatLenderOfferModal({ offer, isOpen, onClose, onSuccess }: AcceptFiatLenderOfferModalProps) {
  const { address } = useAccount();
  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');

  // Get supported assets from Configuration contract
  const { supportedTokens } = useSupportedAssets();
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  const collateralDecimals = getTokenDecimals(collateralToken);

  // Get exchange rates
  const { data: exchangeRates } = useBatchExchangeRates();
  const offerCurrencyRate = offer ? exchangeRates?.[offer.currency] : undefined;

  // Get collateral token data
  const { data: collateralBalance } = useTokenBalance(collateralToken, address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    collateralToken,
    address,
    CONTRACT_ADDRESSES.fiatLoanBridge
  );
  const { price: collateralPrice } = useTokenPrice(collateralToken);

  // Hooks for approval and acceptance
  const { approveAsync, isPending: isApproving, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { acceptFiatLenderOffer, isPending: isAccepting, isSuccess: acceptSuccess } = useAcceptFiatLenderOffer();

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedCollateralAmount > (allowance as bigint);

  // Calculate collateral USD value
  const collateralPricePerToken = collateralPrice ? Number(collateralPrice) / 1e8 : 0;
  const collateralAmountNumber = parseFloat(collateralAmount) || 0;
  const collateralUSD = collateralAmountNumber * collateralPricePerToken;

  // Check if collateral meets minimum requirement
  const meetsMinimum = offer ? collateralUSD >= Number(offer.minCollateralValueUSD) : false;

  // Calculate fiat amount in USD
  const fiatAmountUSD = offer && offerCurrencyRate
    ? Number(convertToUSDCents(offer.fiatAmountCents, offerCurrencyRate)) / 100
    : 0;

  // Calculate LTV
  const ltv = collateralUSD > 0 && fiatAmountUSD > 0
    ? (fiatAmountUSD / collateralUSD) * 100
    : 0;

  // Balance checks
  const maxCollateralBalance = collateralBalance
    ? formatUnits(collateralBalance as bigint, collateralDecimals)
    : '0';
  const hasEnoughBalance = collateralBalance !== undefined && parsedCollateralAmount > 0
    ? BigInt(collateralBalance as bigint) >= parsedCollateralAmount
    : true;

  const isFormValid = offer && collateralAmount && meetsMinimum && hasEnoughBalance;

  // Reset on modal open/close
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setCollateralAmount('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Collateral approved successfully!');
      refetchAllowance();
      setStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (acceptSuccess) {
      toast.success('Fiat lender offer accepted successfully!');
      onSuccess?.();
      onClose();
    }
  }, [acceptSuccess, onSuccess, onClose]);

  const handleMaxClick = () => {
    setCollateralAmount(maxCollateralBalance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!offer || !isFormValid) return;

    if (needsApproval) {
      setStep('approve');
      try {
        await approveAsync(collateralToken, CONTRACT_ADDRESSES.fiatLoanBridge, parsedCollateralAmount);
        // Transaction submitted - useEffect will handle success and move to confirm step
      } catch (error) {
        console.error('Approval failed:', error);
        toast.error('Failed to approve collateral');
        setStep('form');
      }
    } else {
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    if (!offer) return;

    try {
      await acceptFiatLenderOffer(offer.offerId, collateralToken, parsedCollateralAmount);
    } catch (error) {
      console.error('Failed to accept offer:', error);
      toast.error('Failed to accept offer');
    }
  };

  if (!offer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Accept Fiat Lender Offer">
      <div className="space-y-6">
        {/* Offer Details */}
        <div className="glass-card p-4 border-green-500/20">
          <h4 className="text-sm font-semibold mb-3 text-green-400">Offer Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Fiat Amount:</span>
              <span className="font-medium text-green-400">
                {formatCurrency(offer.fiatAmountCents, offer.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">USD Value:</span>
              <span className="font-medium">${fiatAmountUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min Collateral:</span>
              <span className="font-medium">${Number(offer.minCollateralValueUSD).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate:</span>
              <span className="font-medium">{Number(offer.interestRate) / 100}% APY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="font-medium">{Math.ceil(Number(offer.duration) / (24 * 60 * 60))} days</span>
            </div>
          </div>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Collateral Token Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Collateral Token</label>
              <Select
                value={collateralToken}
                onChange={(e) => setCollateralToken(e.target.value as Address)}
                className="w-full"
              >
                {availableTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Collateral Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">Collateral Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.0"
                  className="input-field w-full pr-20"
                />
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-400 hover:text-primary-300"
                >
                  MAX
                </button>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-gray-400">
                  Balance: {formatTokenAmount(collateralBalance ? collateralBalance as bigint : BigInt(0), collateralDecimals)}
                </span>
                {collateralUSD > 0 && (
                  <span className="text-green-400">
                    ≈ ${collateralUSD.toFixed(2)} USD
                  </span>
                )}
              </div>
            </div>

            {/* Validation Messages */}
            {collateralAmount && !meetsMinimum && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">
                  Collateral value (${collateralUSD.toFixed(2)}) is below minimum requirement (${Number(offer.minCollateralValueUSD).toLocaleString()})
                </p>
              </div>
            )}

            {collateralAmount && !hasEnoughBalance && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">
                  Insufficient balance
                </p>
              </div>
            )}

            {collateralAmount && meetsMinimum && hasEnoughBalance && (
              <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-green-400 font-medium">Collateral Sufficient</p>
                  <p className="text-gray-400 mt-1">LTV: {ltv.toFixed(1)}%</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {needsApproval ? 'Approve Collateral' : 'Accept Offer'}
              </Button>
            </div>
          </form>
        )}

        {step === 'approve' && (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-primary-400 mx-auto mb-4 animate-pulse" />
            <h4 className="text-lg font-semibold mb-2">
              {isApproving ? 'Approving Collateral' : isApprovalConfirming ? 'Confirming Transaction' : 'Approving Collateral'}
            </h4>
            <p className="text-gray-400">
              {isApproving
                ? 'Please confirm the transaction in your wallet...'
                : isApprovalConfirming
                  ? 'Waiting for transaction confirmation...'
                  : 'Processing...'}
            </p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h4 className="text-sm font-semibold mb-3">Transaction Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">You Will Receive:</span>
                  <span className="font-medium text-green-400">
                    {formatCurrency(offer.fiatAmountCents, offer.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your Collateral:</span>
                  <span className="font-medium">
                    {collateralAmount} {TOKEN_LIST.find(t => t.address === collateralToken)?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Collateral Value:</span>
                  <span className="font-medium">${collateralUSD.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">LTV:</span>
                  <span className="font-medium">{ltv.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep('form')}
                disabled={isAccepting}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                loading={isAccepting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Confirm & Accept
              </Button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300">
            Your collateral will be locked until the loan is repaid. The supplier will disburse the fiat amount to you off-chain after accepting.
          </p>
        </div>
      </div>
    </Modal>
  );
}
