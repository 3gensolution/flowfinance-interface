'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Abi } from 'viem';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, CalendarPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useRequestExtension,
  useLoanExtension,
} from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import { useLoansByBorrower } from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import { formatDuration } from '@/lib/utils';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

export function RequestExtensionModal() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Get modal state from store
  const { extensionModalOpen, extensionLoanId, closeExtensionModal } = useUIStore();

  // Get borrowed loans
  const borrowedLoans = useLoansByBorrower(address);

  // Local state
  const [additionalDays, setAdditionalDays] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationError, setSimulationError] = useState('');

  // Find the loan
  const selectedLoan = useMemo(() => {
    if (!extensionLoanId) return null;
    return borrowedLoans.find(l => l.loanId === extensionLoanId) || null;
  }, [extensionLoanId, borrowedLoans]);

  // Contract hooks
  const { requestExtension, isPending: isExtensionPending } = useRequestExtension();

  // Get current extension state
  const { data: extensionData } = useLoanExtension(extensionLoanId || undefined);
  const extensionInfo = extensionData as readonly [bigint, boolean, boolean] | undefined;
  const extensionAdditionalDuration = extensionInfo ? extensionInfo[0] : BigInt(0);
  const extensionRequested = extensionInfo ? extensionInfo[1] : false;
  const extensionApproved = extensionInfo ? extensionInfo[2] : false;

  // Computed values
  const currentDueDate = selectedLoan ? new Date(Number(selectedLoan.dueDate) * 1000) : null;
  const additionalSeconds = additionalDays ? BigInt(Math.floor(Number(additionalDays) * 86400)) : BigInt(0);
  const newDueDate = currentDueDate && additionalSeconds > BigInt(0)
    ? new Date(currentDueDate.getTime() + Number(additionalSeconds) * 1000)
    : null;

  const handleClose = useCallback(() => {
    setAdditionalDays('');
    setSimulationError('');
    closeExtensionModal();
  }, [closeExtensionModal]);

  const handleSubmit = useCallback(async () => {
    if (!selectedLoan || !address || !publicClient || additionalSeconds === BigInt(0)) return;

    setIsSubmitting(true);
    setSimulationError('');
    const toastId = toast.loading('Simulating extension request...');

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'requestLoanExtension',
        args: [selectedLoan.loanId, additionalSeconds],
        account: address,
      });

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Extension request simulation failed';
        setSimulationError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        setIsSubmitting(false);
        return;
      }

      toast.loading('Requesting extension...', { id: toastId });
      requestExtension(selectedLoan.loanId, additionalSeconds);

      toast.success('Extension request submitted! Waiting for lender approval.', { id: toastId });
      handleClose();
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedLoan, address, publicClient, additionalSeconds, requestExtension, handleClose]);

  if (!selectedLoan) {
    return (
      <Modal isOpen={extensionModalOpen} onClose={handleClose} title="Request Loan Extension">
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading loan data...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={extensionModalOpen} onClose={handleClose} title="Request Loan Extension">
      <div className="space-y-4">
        {/* Current loan timeline */}
        <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Loan ID</span>
            <span>#{selectedLoan.loanId.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Current Duration</span>
            <span>{formatDuration(selectedLoan.duration)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Current Due Date</span>
            <span>{currentDueDate?.toLocaleDateString()}</span>
          </div>
        </div>

        {/* Existing extension status */}
        {extensionRequested && !extensionApproved && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-400 font-medium">Extension Already Requested</p>
            </div>
            <p className="text-sm text-gray-400">
              You have already requested an extension of {formatDuration(extensionAdditionalDuration)}.
              Waiting for lender approval.
            </p>
          </div>
        )}

        {extensionRequested && extensionApproved && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CalendarPlus className="w-4 h-4 text-green-400" />
              <p className="text-green-400 font-medium">Extension Approved</p>
            </div>
            <p className="text-sm text-gray-400">
              Your extension of {formatDuration(extensionAdditionalDuration)} has been approved by the lender.
            </p>
          </div>
        )}

        {/* Request form - only show if no pending request */}
        {!extensionRequested && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Additional Days
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={additionalDays}
                  onChange={(e) => setAdditionalDays(e.target.value)}
                  placeholder="Enter number of days"
                  min="1"
                  className="input-field flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdditionalDays('7')}
                >
                  7d
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdditionalDays('14')}
                >
                  14d
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdditionalDays('30')}
                >
                  30d
                </Button>
              </div>
              {additionalDays && Number(additionalDays) <= 0 && (
                <p className="text-xs text-red-400 mt-1">Duration must be greater than 0</p>
              )}
            </div>

            {/* New due date preview */}
            {newDueDate && (
              <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarPlus className="w-4 h-4 text-primary-400" />
                  <p className="text-primary-400 font-medium">New Due Date</p>
                </div>
                <p className="text-lg font-semibold text-white">{newDueDate.toLocaleDateString()}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Extended by {additionalDays} day{Number(additionalDays) !== 1 ? 's' : ''} from current due date.
                  The lender must approve this extension.
                </p>
              </div>
            )}

            {simulationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{simulationError}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!additionalDays || Number(additionalDays) <= 0 || isSubmitting || isExtensionPending}
                loading={isSubmitting || isExtensionPending}
                className="flex-1"
              >
                {isSubmitting || isExtensionPending ? 'Requesting...' : 'Request Extension'}
              </Button>
            </div>
          </>
        )}

        {/* Close button when extension already requested */}
        {extensionRequested && (
          <div className="pt-4">
            <Button variant="secondary" onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
