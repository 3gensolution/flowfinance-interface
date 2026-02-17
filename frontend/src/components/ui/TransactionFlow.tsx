'use client';

import { motion } from 'framer-motion';
import { ApprovalInfo } from './ApprovalInfo';
import { ErrorMessage } from './ErrorMessage';
import { TransactionButton } from './TransactionButton';
import { SuccessModal } from './SuccessModal';

interface TransactionFlowProps {
  // Approval
  needsApproval: boolean;
  tokenSymbol: string;
  approvalSafetyNote?: string;

  // State
  isApproving: boolean;
  isCreating: boolean;
  isValid: boolean;

  // Error
  errorMessage: string | null;
  errorTitle?: string;
  onDismissError: () => void;

  // Actions
  onApprove: () => void;
  onSubmit: () => void;

  // Button text
  submitText?: string;
  submitLoadingText?: string;

  // Status
  statusText?: string | null;

  // Success modal
  showSuccess: boolean;
  successTitle: string;
  successMessage: string;
  onGoToMarketplace: () => void;
}

export function TransactionFlow({
  needsApproval,
  tokenSymbol,
  approvalSafetyNote,
  isApproving,
  isCreating,
  isValid,
  errorMessage,
  errorTitle = 'Error',
  onDismissError,
  onApprove,
  onSubmit,
  submitText,
  submitLoadingText,
  statusText,
  showSuccess,
  successTitle,
  successMessage,
  onGoToMarketplace,
}: TransactionFlowProps) {
  const isProcessing = isApproving || isCreating;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mx-auto space-y-4"
      >
        {/* Approval Info */}
        {needsApproval && (
          <ApprovalInfo
            tokenSymbol={tokenSymbol}
            safetyNote={approvalSafetyNote}
          />
        )}

        {/* Error Message */}
        {errorMessage && (
          <ErrorMessage
            message={errorMessage}
            title={errorTitle}
            onDismiss={onDismissError}
          />
        )}

        {/* Transaction Buttons */}
        <div className="space-y-3">
          {needsApproval && (
            <TransactionButton
              type="approve"
              tokenSymbol={tokenSymbol}
              isLoading={isApproving}
              isDisabled={!isValid || isProcessing}
              stepNumber={1}
              onClick={onApprove}
            />
          )}
          <TransactionButton
            type="submit"
            isLoading={isCreating}
            isDisabled={!isValid || needsApproval || isProcessing}
            isSecondary={needsApproval}
            stepNumber={needsApproval ? 2 : undefined}
            onClick={onSubmit}
            defaultText={submitText}
            loadingText={submitLoadingText}
          />
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
        isOpen={showSuccess}
        title={successTitle}
        message={successMessage}
        onGoToMarketplace={onGoToMarketplace}
      />
    </>
  );
}
