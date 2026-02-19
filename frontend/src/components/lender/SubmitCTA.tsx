'use client';

import { useState, useEffect } from 'react';
import { parseUnits, Address } from 'viem';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Asset } from './AssetSelector';
import { AssetType } from './AssetTypeSelector';
import { TransactionFlow } from '@/components/ui/TransactionFlow';
import {
  useCreateLenderOffer,
  useApproveToken,
  useTokenAllowance,
  useLoanConfigLimits,
} from '@/hooks/useContracts';
import { useCreateFiatLenderOffer } from '@/hooks/useFiatLoan';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
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

  // Effects
  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
      setSubmitStep('idle');
    }
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
      const flexibleCollateral = '0x0000000000000000000000000000000000000000' as Address;

      const simulation = await simulateCreateOffer(
        asset.address as Address,
        amountInWei,
        flexibleCollateral,
        BigInt(0),
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
        flexibleCollateral,
        BigInt(0),
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

  return (
    <TransactionFlow
      needsApproval={isCryptoAsset && needsApproval}
      tokenSymbol={asset?.symbol || ''}
      approvalSafetyNote="Your funds remain safe in your account until your offer is accepted."
      isApproving={isApproving}
      isCreating={isCreating}
      isValid={isValid}
      errorMessage={errorMessage}
      errorTitle={isCryptoAsset ? 'Transaction Failed' : 'Error'}
      onDismissError={handleDismissError}
      onApprove={handleApprove}
      onSubmit={isCryptoAsset ? handleCreateOffer : handleCreateFiatOffer}
      submitText="Start Lending"
      statusText={getStatusText()}
      showSuccess={showSuccessModal}
      successTitle="Offer Created Successfully!"
      successMessage={`Your lending offer of ${amount} ${asset?.symbol || ''} at ${rate}% APR is now live on the marketplace.`}
      onGoToMarketplace={handleGoToMarketplace}
    />
  );
}
