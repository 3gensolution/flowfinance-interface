'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { LoanRequest, LenderOffer } from '@/types';
import { FiatLoan, FiatLenderOffer } from '@/hooks/useFiatLoan';
import { useCancelLoanRequest, useCancelLenderOffer } from '@/hooks/useContracts';
import { useCancelFiatLenderOffer, useCancelFiatLoanRequest } from '@/hooks/useFiatLoan';
import { formatSimulationError } from '@/lib/contractSimulation';
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
  const { cancelFiatLoanRequest } = useCancelFiatLoanRequest();

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

  return (
    <BaseFiatLoanRequestCard
      loan={loan}
      isOwner={true}
      onCancel={handleCancel}
      loading={isLoading}
      chainId={chainId}
    />
  );
}
