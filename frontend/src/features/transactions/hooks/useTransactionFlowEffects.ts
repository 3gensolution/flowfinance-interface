'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

type StepSetter<TStep extends string> = (step: TStep) => void;

interface TransactionFlowEffectsOptions<TStep extends string> {
  approvalSuccess?: boolean;
  approvalSuccessMessage?: string;
  refetchAllowance?: () => unknown;
  setStep?: StepSetter<TStep>;
  nextStep?: TStep;
  actionSuccess?: boolean;
  actionSuccessMessage?: string;
  onActionSuccess?: () => void;
  actionError?: unknown;
  fallbackActionErrorMessage?: string;
  onActionError?: (message: string) => void;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallbackMessage;
}

export function useTransactionFlowEffects<TStep extends string>({
  approvalSuccess,
  approvalSuccessMessage,
  refetchAllowance,
  setStep,
  nextStep,
  actionSuccess,
  actionSuccessMessage,
  onActionSuccess,
  actionError,
  fallbackActionErrorMessage = 'Transaction failed',
  onActionError,
}: TransactionFlowEffectsOptions<TStep>) {
  useEffect(() => {
    if (!approvalSuccess) return;

    if (approvalSuccessMessage) {
      toast.success(approvalSuccessMessage);
    }

    refetchAllowance?.();

    if (setStep && nextStep) {
      setStep(nextStep);
    }
  }, [approvalSuccess, approvalSuccessMessage, refetchAllowance, setStep, nextStep]);

  useEffect(() => {
    if (!actionSuccess) return;

    if (actionSuccessMessage) {
      toast.success(actionSuccessMessage);
    }

    onActionSuccess?.();
  }, [actionSuccess, actionSuccessMessage, onActionSuccess]);

  useEffect(() => {
    if (!actionError) return;

    const errorMessage = getErrorMessage(actionError, fallbackActionErrorMessage);
    onActionError?.(errorMessage);
    toast.error(errorMessage);
  }, [actionError, fallbackActionErrorMessage, onActionError]);
}
