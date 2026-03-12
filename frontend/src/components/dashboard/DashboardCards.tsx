'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { LoanRequest, LenderOffer } from '@/types';
import { FiatLoan, FiatLoanStatus, FiatLenderOffer } from '@/hooks/useFiatLoan';
import { useCancelLoanRequest, useCancelLenderOffer } from '@/hooks/useContracts';
import { useCancelFiatLenderOffer, useCancelFiatLoanRequest } from '@/hooks/useFiatLoan';
import { formatSimulationError } from '@/lib/contractSimulation';
import { formatCurrency } from '@/hooks/useFiatOracle';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ExternalLink, AlertTriangle, Banknote } from 'lucide-react';
import { useGenerateLinkApi } from '@/hooks/useGenerateLink';
import { GenerateLinkResponse } from '@/services/mutation/generate-link';
import { useAccount } from 'wagmi';
import {
  LoanRequestCard as BaseLoanRequestCard,
  LenderOfferCard as BaseLenderOfferCard,
  FiatLenderOfferCard as BaseFiatLenderOfferCard,
  FiatLoanRequestCard as BaseFiatLoanRequestCard,
} from '@/components/loan/LoanCard';

interface DashboardLoanRequestCardProps {
  request: LoanRequest;
  chainId?: number;
}

export function DashboardLoanRequestCard({ request, chainId }: DashboardLoanRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { cancelRequest } = useCancelLoanRequest();

  const handleCancel = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Cancelling request...');
    try {
      cancelRequest(request.requestId);
      toast.success('Request cancellation submitted!', { id: toastId });
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseLoanRequestCard
      request={request}
      isOwner={true}
      onCancel={handleCancel}
      loading={isLoading}
      chainId={chainId}
    />
  );
}

interface DashboardLenderOfferCardProps {
  offer: LenderOffer;
  chainId?: number;
}

export function DashboardLenderOfferCard({ offer, chainId }: DashboardLenderOfferCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { cancelOffer } = useCancelLenderOffer();

  const handleCancel = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Cancelling offer...');
    try {
      cancelOffer(offer.offerId);
      toast.success('Offer cancellation submitted!', { id: toastId });
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseLenderOfferCard
      offer={offer}
      isOwner={true}
      onCancel={handleCancel}
      loading={isLoading}
      chainId={chainId}
    />
  );
}

interface DashboardFiatLenderOfferCardProps {
  offer: FiatLenderOffer;
  chainId?: number;
}

export function DashboardFiatLenderOfferCard({ offer }: DashboardFiatLenderOfferCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { cancelFiatLenderOffer } = useCancelFiatLenderOffer();

  const handleCancel = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Cancelling fiat offer...');
    try {
      await cancelFiatLenderOffer(offer.offerId);
      toast.success('Fiat offer cancellation submitted!', { id: toastId });
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseFiatLenderOfferCard
      offer={offer}
      isOwner={true}
      onCancel={handleCancel}
      loading={isLoading}
    />
  );
}

interface DashboardFiatLoanRequestCardProps {
  loan: FiatLoan;
  chainId?: number;
}

export function DashboardFiatLoanRequestCard({ loan, chainId }: DashboardFiatLoanRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAccepted, setClaimAccepted] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAccepted, setRepayAccepted] = useState(false);
  const [generatedClaimLink, setGeneratedClaimLink] = useState<string | null>(null);
  const [generatedRepayLink, setGeneratedRepayLink] = useState<string | null>(null);
  const { cancelFiatLoanRequest } = useCancelFiatLoanRequest();
  const { mutate: generateLinkMutation, isPending: isGeneratingLink } = useGenerateLinkApi();
  const { address } = useAccount();

  const handleCancel = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Cancelling fiat loan request...');
    try {
      await cancelFiatLoanRequest(loan.loanId);
      toast.success('Fiat loan request cancellation submitted!', { id: toastId });
    } catch (error: unknown) {
      toast.error(formatSimulationError(error), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimFunds = () => {
    setShowClaimModal(true);
    setClaimAccepted(false);
    setGeneratedClaimLink(null);
  };

  const handleRepay = () => {
    setShowRepayModal(true);
    setRepayAccepted(false);
    setGeneratedRepayLink(null);
  };

  const handleGenerateLink = (target: 'claim' | 'repay') => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    generateLinkMutation(
      { walletAddress: address, state: 'claims' },
      {
        onSuccess: (response: { data: GenerateLinkResponse }) => {
          const url = `${response.data.data.url}&state=claims`;
          if (target === 'claim') {
            setGeneratedClaimLink(url);
          } else {
            setGeneratedRepayLink(url);
          }
          toast.success('Link generated successfully!');
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to generate link');
        },
      }
    );
  };

  const handleContinueToLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Calculate total debt for repay modal
  const interestRate = Number(loan.interestRate) / 100;
  const fiatAmountCents = Number(loan.fiatAmountCents);
  const totalDebtCents = Math.ceil(fiatAmountCents * (1 + interestRate / 100));

  return (
    <>
      <BaseFiatLoanRequestCard
        loan={loan}
        isOwner={true}
        onCancel={handleCancel}
        onClaimFunds={loan.status === FiatLoanStatus.ACTIVE && !loan.fundsWithdrawn ? handleClaimFunds : undefined}
        onRepay={loan.status === FiatLoanStatus.ACTIVE && loan.fundsWithdrawn ? handleRepay : undefined}
        loading={isLoading}
        chainId={chainId}
      />

      {/* Claim Funds Modal */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        title="Claim Funds"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-yellow-400 font-medium">Third-Party Redirect</p>
                <p className="text-gray-400 mt-1">
                  You will be redirected to a third-party service to claim your funds of{' '}
                  <span className="text-green-400 font-medium">
                    {formatCurrency(loan.fiatAmountCents, loan.currency)}
                  </span>.
                  Please ensure you complete the withdrawal process on the external platform.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={claimAccepted}
              onChange={(e) => setClaimAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-white/5 text-green-500 focus:ring-green-500/50 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-gray-300">
              I understand that I will be redirected to a third-party platform to receive my cash and that the funds claim is handled externally.
            </span>
          </label>

          {!generatedClaimLink ? (
            <Button
              onClick={() => handleGenerateLink('claim')}
              disabled={!claimAccepted}
              loading={isGeneratingLink}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => handleContinueToLink(generatedClaimLink)}
              className="w-full bg-green-600 hover:bg-green-700"
              icon={<ExternalLink className="w-4 h-4" />}
            >
              Proceed to Claim Funds
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowClaimModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Repay Modal */}
      <Modal
        isOpen={showRepayModal}
        onClose={() => setShowRepayModal(false)}
        title="Repay Loan"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-400 font-medium">Third-Party Redirect</p>
                <p className="text-gray-400 mt-1">
                  You will be redirected to a third-party service to repay your loan. Total debt:{' '}
                  <span className="text-blue-400 font-medium">
                    {formatCurrency(BigInt(totalDebtCents), loan.currency)}
                  </span>.
                  Please ensure you complete the repayment process on the external platform.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={repayAccepted}
              onChange={(e) => setRepayAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-white/5 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-gray-300">
              I understand that I will be redirected to a third-party platform to complete my loan repayment and that the process is handled externally.
            </span>
          </label>

          {!generatedRepayLink ? (
            <Button
              onClick={() => handleGenerateLink('repay')}
              disabled={!repayAccepted}
              loading={isGeneratingLink}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => handleContinueToLink(generatedRepayLink)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              icon={<ExternalLink className="w-4 h-4" />}
            >
              Proceed to Repay
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowRepayModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
