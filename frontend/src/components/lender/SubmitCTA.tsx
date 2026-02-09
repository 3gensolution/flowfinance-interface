'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { parseUnits, Address } from 'viem';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Asset } from './AssetSelector';
import { AssetType } from './AssetTypeSelector';
import { ErrorMessage } from './ErrorMessage';
import { ApprovalInfo } from './ApprovalInfo';
import { SuccessModal } from './SuccessModal';
import { TransactionButton } from './TransactionButton';
import {
  useCreateLenderOffer,
  useApproveToken,
  useTokenAllowance,
  useLoanConfigLimits,
} from '@/hooks/useContracts';
import { useCreateFiatLenderOffer } from '@/hooks/useFiatLoan';
import { CONTRACT_ADDRESSES, TOKEN_LIST } from '@/config/contracts';
import { formatSimulationError } from '@/lib/contractSimulation';

interface SubmitCTAProps {
  asset: Asset | null;
  amount: string;
  rate: number;
  isValid: boolean;
  assetType: AssetType;
  onSubmit: () => void;
}

type SubmitStep = 'idle' | 'approving' | 'creating' | 'success';

export function SubmitCTA({ asset, amount, rate, isValid, assetType }: SubmitCTAProps) {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isCryptoAsset = assetType === 'crypto' && !!asset?.address;
  const { maxDurationSeconds } = useLoanConfigLimits();

  // Hooks
  const { approveAsync, simulateApprove, hash: approveHash, isPending: isApprovePending } = useApproveToken();
  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { createOfferAsync, simulateCreateOffer, hash: createHash, isPending: isCreatePending } = useCreateLenderOffer();
  const { isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({ hash: createHash });
  const { createFiatLenderOffer, hash: fiatCreateHash, isPending: isFiatCreatePending } = useCreateFiatLenderOffer();
  const { isSuccess: isFiatCreateConfirmed } = useWaitForTransactionReceipt({ hash: fiatCreateHash });

  const tokenAddress = isCryptoAsset ? (asset?.address as Address) : undefined;
  const { data: allowanceData, refetch: refetchAllowance } = useTokenAllowance(
    tokenAddress,
    userAddress,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  const amountInWei = isCryptoAsset && asset && amount
    ? parseUnits(amount, asset.decimals || 18)
    : BigInt(0);

  const currentAllowance = allowanceData != null ? BigInt(allowanceData.toString()) : BigInt(0);
  const needsApproval = isCryptoAsset && currentAllowance < amountInWei;

  const isApproving = submitStep === 'approving' || isApprovePending;
  const isCreating = submitStep === 'creating' || isCreatePending || isFiatCreatePending;
  const isProcessing = isApproving || isCreating;

  // Effects
  useEffect(() => {
    if (isApproveConfirmed) refetchAllowance();
  }, [isApproveConfirmed, refetchAllowance]);

  useEffect(() => {
    const isConfirmed = isCryptoAsset ? isCreateConfirmed : isFiatCreateConfirmed;
    if (isConfirmed && submitStep === 'creating') {
      setSubmitStep('success');
      setShowSuccessModal(true);
      const timeout = setTimeout(() => router.push('/marketplace'), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isCreateConfirmed, isFiatCreateConfirmed, submitStep, router, isCryptoAsset]);

  // Handlers
  const handleApprove = async () => {
    if (!asset || !userAddress || !asset.address) return;
    setErrorMessage(null);
    setSubmitStep('approving');

    try {
      const simulation = await simulateApprove(
        asset.address as Address,
        CONTRACT_ADDRESSES.loanMarketPlace,
        amountInWei,
        userAddress
      );

      if (!simulation.success) {
        setSubmitStep('idle');
        setErrorMessage(simulation.error || 'Approval simulation failed');
        return;
      }

      await approveAsync(asset.address as Address, CONTRACT_ADDRESSES.loanMarketPlace, amountInWei);
    } catch (err) {
      setSubmitStep('idle');
      setErrorMessage(formatSimulationError(err));
    }
  };

  const handleCreateOffer = async () => {
    if (!isValid || !asset || !userAddress || (isCryptoAsset && !asset.address)) return;
    setErrorMessage(null);
    setSubmitStep('creating');

    try {
      const interestRateBps = BigInt(Math.round(rate * 100));
      const duration = BigInt(maxDurationSeconds || 30 * 24 * 60 * 60);
      const defaultCollateralAsset = TOKEN_LIST[0]?.address || (asset.address as Address);

      const simulation = await simulateCreateOffer(
        asset.address as Address,
        amountInWei,
        defaultCollateralAsset as Address,
        BigInt(1),
        interestRateBps,
        duration,
        userAddress
      );

      if (!simulation.success) {
        setSubmitStep('idle');
        setErrorMessage(simulation.error || 'Transaction simulation failed');
        return;
      }

      await createOfferAsync(
        asset.address as Address,
        amountInWei,
        defaultCollateralAsset as Address,
        BigInt(1),
        interestRateBps,
        duration
      );
    } catch (err) {
      setSubmitStep('idle');
      setErrorMessage(formatSimulationError(err));
    }
  };

  const handleCreateFiatOffer = async () => {
    if (!isValid || !asset || !userAddress) return;
    setErrorMessage(null);
    setSubmitStep('creating');

    try {
      const interestRateBps = BigInt(Math.round(rate * 100));
      const duration = BigInt(maxDurationSeconds || 30 * 24 * 60 * 60);
      const amountCents = BigInt(Math.round(parseFloat(amount) * 100));

      await createFiatLenderOffer(amountCents, asset.symbol, BigInt(1e8), duration, interestRateBps);
    } catch (err) {
      setSubmitStep('idle');
      setErrorMessage(formatSimulationError(err));
    }
  };

  const handleGoToMarketplace = () => router.push('/marketplace');
  const handleDismissError = () => setErrorMessage(null);

  // Status text
  const getStatusText = () => {
    if (isApproving) return 'Please confirm the approval in your wallet...';
    if (isCreating) return 'Please confirm the transaction in your wallet...';
    if (!errorMessage) return 'Withdraw unused funds anytime.';
    return null;
  };

  const statusText = getStatusText();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mx-auto space-y-4"
      >
        {/* Approval Info (crypto only) */}
        {isCryptoAsset && needsApproval && <ApprovalInfo tokenSymbol={asset?.symbol || ''} />}

        {/* Error Message */}
        {errorMessage && (
          <ErrorMessage
            message={errorMessage}
            title={isCryptoAsset ? 'Transaction Failed' : 'Error'}
            onDismiss={handleDismissError}
          />
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {isCryptoAsset ? (
            <>
              {needsApproval && (
                <TransactionButton
                  type="approve"
                  tokenSymbol={asset?.symbol}
                  isLoading={isApproving}
                  isDisabled={!isValid || isProcessing}
                  stepNumber={1}
                  onClick={handleApprove}
                />
              )}
              <TransactionButton
                type="submit"
                isLoading={isCreating}
                isDisabled={!isValid || needsApproval || isProcessing}
                isSecondary={needsApproval}
                stepNumber={needsApproval ? 2 : undefined}
                onClick={handleCreateOffer}
              />
            </>
          ) : (
            <TransactionButton
              type="submit"
              isLoading={isCreating}
              isDisabled={!isValid || isProcessing}
              onClick={handleCreateFiatOffer}
            />
          )}
        </div>

        {/* Status Text */}
        {statusText && (
          <p className={`text-sm text-center ${isProcessing ? 'text-white/60' : 'text-white/40'}`}>
            {statusText}
          </p>
        )}
      </motion.div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        amount={amount}
        tokenSymbol={asset?.symbol || ''}
        rate={rate}
        onGoToMarketplace={handleGoToMarketplace}
      />
    </>
  );
}
