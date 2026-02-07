/**
 * Contract Simulation Utilities
 *
 * This module provides utilities for simulating contract calls before executing them.
 * This helps save users time and gas fees by catching errors before sending transactions.
 */

import { simulateContract, type SimulateContractParameters } from '@wagmi/core';
import { config } from '@/config/wagmi';

/**
 * Helper type for contract simulation error handling
 */
export interface SimulationError extends Error {
    shortMessage?: string;
    cause?: {
        reason?: string;
        data?: {
            errorName?: string;
            args?: unknown[];
        };
        signature?: string;
    };
    data?: {
        errorName?: string;
        args?: unknown[];
    };
    metaMessages?: string[];
}

/**
 * Known custom error signatures and their human-readable messages
 */
const CUSTOM_ERROR_SIGNATURES: Record<string, string> = {
    '0xe450d38c': 'Insufficient token balance. Please check your wallet balance.',
    '0xfb8f41b2': 'Insufficient allowance. Please approve the token first.',
    '0x13be252b': 'Caller is not authorized.',
    '0x118cdaa7': 'Owner is not authorized.',
    '0x8c379a0': 'Transaction reverted.',
    '0x4e487b71': 'Panic error (arithmetic overflow/underflow).',
};

/**
 * Known error names and their human-readable messages
 */
const CUSTOM_ERROR_NAMES: Record<string, string> = {
    // ERC20 errors
    'ERC20InsufficientBalance': 'Insufficient token balance. You need more tokens to complete this transaction.',
    'ERC20InsufficientAllowance': 'Insufficient allowance. Please approve the token first.',
    'SafeERC20FailedOperation': 'Token transfer failed. Please check your balance and try again.',

    // Ownable/Access errors
    'OwnableUnauthorizedAccount': 'You are not authorized to perform this action.',
    'OwnableInvalidOwner': 'Invalid owner address.',
    'AccessControlUnauthorizedAccount': 'You do not have the required role to perform this action.',

    // Generic errors
    'InvalidAmount': 'Invalid amount specified.',
    'InvalidDuration': 'Invalid loan duration.',
    'InvalidInterestRate': 'Interest rate outside allowed range.',
    'AssetNotEnabled': 'This asset is not enabled for lending.',
    'LTVExceeded': 'Borrow amount exceeds maximum LTV for this collateral.',
    'LoanNotFound': 'Loan not found.',
    'PriceDataStale': 'Price data is stale. Please wait for price feeds to be refreshed.',
    'PriceFeedNotSet': 'Price feed not configured for this token.',
    'InvalidPrice': 'Invalid price returned from oracle.',

    // LoanMarketPlace specific errors
    'AlreadyApproved': 'This has already been approved.',
    'AmountExceedsDebt': 'Repayment amount exceeds the remaining debt. Please enter a smaller amount.',
    'AmountMustBeGreaterThanZero': 'Amount must be greater than zero.',
    'BorrowAssetNotSupported': 'This borrow asset is not supported by the platform.',
    'CannotAcceptOwnOffer': 'You cannot accept your own lending offer.',
    'CannotFundOwnRequest': 'You cannot fund your own loan request.',
    'CollateralAssetRequired': 'Collateral asset is required.',
    'CollateralNotSupported': 'This collateral token is not supported.',
    'EnforcedPause': 'The contract is currently paused for maintenance.',
    'ExtensionAlreadyRequested': 'A loan extension has already been requested.',
    'GracePeriodNotExpired': 'The grace period has not expired yet.',
    'InsufficientCollateral': 'Insufficient collateral provided. Please increase your collateral amount.',
    'InvalidConfigAddress': 'Invalid configuration address.',
    'InvalidEscrowAddress': 'Invalid escrow address.',
    'InvalidLiquidator': 'Invalid liquidator address.',
    'InvalidLoanID': 'Invalid loan ID.',
    'InvalidPercentage': 'Invalid percentage value.',
    'InvalidRequest': 'Invalid request.',
    'LTVExceedsMaximum': 'The loan-to-value ratio exceeds the maximum allowed for this collateral.',
    'LoanCannotBeLiquidated': 'This loan cannot be liquidated at this time.',
    'LoanIsStillHealthy': 'The loan is still healthy and cannot be liquidated.',
    'LoanMustBeActiveForMinimumDuration': 'Loan must be active for a minimum duration before this action.',
    'LoanNotActive': 'This loan is not active.',
    'NoCollateral': 'No collateral has been provided.',
    'NoExtensionRequested': 'No extension has been requested for this loan.',
    'NotACrossChainLoan': 'This is not a cross-chain loan.',
    'NotTheBorrower': 'Only the borrower can perform this action.',
    'NotTheLender': 'Only the lender can perform this action.',
    'OfferNotAvailable': 'This offer is no longer available.',
    'OfferNotExpiredYet': 'This offer has not expired yet.',
    'OfferNotPending': 'This offer is not in pending status.',
    'OnlyBorrowerCanRepay': 'Only the borrower can repay this loan.',
    'OnlyLenderCanCancel': 'Only the lender can cancel this offer.',
    'Overpayment': 'Payment amount exceeds the loan balance.',
    'RepaymentBelowMinimum': 'Repayment amount is below the minimum required.',
    'RequestExpired': 'This loan request has expired.',
    'RequestIsNotPending': 'This request is not in pending status.',
    'RequestNotExpiredYet': 'This request has not expired yet.',
    'RequestNotFunded': 'This request has not been funded.',
    'RequestNotPending': 'This request is not pending.',
    'ReentrancyGuardReentrantCall': 'Transaction blocked due to reentrancy protection.',
    'LoanTooNew': 'This loan was recently created. Please wait before performing this action.',
    'OnlyCrossChainManager': 'Only the cross-chain manager can perform this action.',
    'CannotLiquidate': 'This loan cannot be liquidated at this time.',
    'SourceChainNotSupported': 'The source chain is not supported for cross-chain operations.',

    // FiatLoanBridge specific errors
    'AssetNotSupported': 'This collateral asset is not supported. Please select a different token.',
    'OfferNotActive': 'This offer is no longer active.',
    'OfferExpired': 'This offer has expired and can no longer be accepted.',
    'CannotAcceptOwn': 'You cannot accept your own offer.',
    'OfferFullyUtilized': 'This offer has been fully utilized. No remaining funds available.',
    'InsufficientOfferBalance': 'The requested borrow amount exceeds the remaining offer balance.',
    'LTVTooHigh': 'The loan-to-value ratio is too high. Please provide more collateral.',
    'NotKYCVerified': 'Your account has not been KYC verified. Please complete verification first.',
    'InsufficientSupplierBalance': 'Insufficient supplier balance for this loan amount.',
    'DisbursementNotConfirmed': 'The fiat disbursement has not been confirmed yet.',
    'LoanNotPendingOrActive': 'This loan is not in a pending or active state.',
    'NotSupplier': 'Only the supplier can perform this action.',
    'NotBorrower': 'Only the borrower can perform this action.',
    'LoanAlreadyRepaid': 'This loan has already been fully repaid.',
    'RepaymentNotConfirmed': 'The fiat repayment has not been confirmed yet.',
    'InvalidAddress': 'Invalid address provided.',
    'InvalidRate': 'Interest rate is outside the allowed range.',
    'CannotCancel': 'This loan request cannot be cancelled in its current state.',
    'InsufficientBalance': 'Insufficient balance to complete this operation.',
    'FundsAlreadyWithdrawn': 'The funds have already been withdrawn from this loan.',
    'NoClaimableFunds': 'There are no funds available to claim for this loan.',
    'GraceNotExpired': 'The grace period has not expired yet. Cannot liquidate.',
    'LoanHealthy': 'The loan is healthy and cannot be liquidated.',
    'InvalidLoanStatus': 'The loan is not in the required status for this operation.',
    'NotPending': 'This loan is not in pending status.',
    'HasSupplier': 'This loan already has a supplier assigned.',
    'OnlyIncrease': 'The new value must be greater than the current value.',
    'OffersOnlyOnSupplierChain': 'Offers can only be created on the supplier chain (Base).',
    'OnlyRelayService': 'Only the relay service can perform this action.',
    'NotCrossChainLoan': 'This operation is only valid for cross-chain loans.',
    'RelayTimeoutNotReached': 'The relay timeout has not been reached yet.',
    'CannotModifyOwnChain': 'Cannot modify chain settings for the current chain.',
    'CannotFundOwnLoan': 'You cannot fund your own loan request.',
    'CurrencyNotSupported': 'The selected currency is not supported.',
};

/**
 * Format simulation error to user-friendly message
 */
export const formatSimulationError = (error: unknown): string => {
    // Handle non-object errors
    if (!error || typeof error !== 'object') {
        return String(error) || 'Contract simulation failed';
    }

    const err = error as SimulationError;

    // Log full error for debugging (remove in production)
    console.error('Contract error details:', {
        name: (error as { name?: string }).name,
        message: err.message,
        shortMessage: err.shortMessage,
        cause: err.cause,
        data: err.data,
        metaMessages: err.metaMessages,
    });

    // Check for error name directly on the error object (wagmi/viem errors)
    const errorName = (error as { name?: string }).name;
    if (errorName && CUSTOM_ERROR_NAMES[errorName]) {
        return CUSTOM_ERROR_NAMES[errorName];
    }

    // Check for ContractFunctionRevertedError which contains the decoded error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyError = error as any;
    if (anyError.cause?.name && CUSTOM_ERROR_NAMES[anyError.cause.name]) {
        return CUSTOM_ERROR_NAMES[anyError.cause.name];
    }

    // Walk through nested causes to find the actual error
    let currentCause = anyError.cause;
    while (currentCause) {
        if (currentCause.name && CUSTOM_ERROR_NAMES[currentCause.name]) {
            return CUSTOM_ERROR_NAMES[currentCause.name];
        }
        if (currentCause.data?.errorName && CUSTOM_ERROR_NAMES[currentCause.data.errorName]) {
            return CUSTOM_ERROR_NAMES[currentCause.data.errorName];
        }
        currentCause = currentCause.cause;
    }

    // Helper function to check all text sources for a signature
    const findSignatureInError = (): string | null => {
        const allText = [
            err.message,
            err.shortMessage,
            err.cause?.reason,
            ...(err.metaMessages || []),
        ].filter(Boolean).join(' ');

        // Look for signature pattern like "0xe450d38c"
        const sigMatch = allText.match(/0x[a-fA-F0-9]{8}/g);
        if (sigMatch) {
            for (const sig of sigMatch) {
                const normalizedSig = sig.toLowerCase();
                if (CUSTOM_ERROR_SIGNATURES[normalizedSig]) {
                    return CUSTOM_ERROR_SIGNATURES[normalizedSig];
                }
            }
        }
        return null;
    };

    // PRIORITY 1: Check for known error signatures first (most reliable)
    const signatureError = findSignatureInError();
    if (signatureError) {
        return signatureError;
    }

    // PRIORITY 2: Check cause signature directly
    if (err.cause?.signature) {
        const signature = err.cause.signature.toLowerCase();
        if (CUSTOM_ERROR_SIGNATURES[signature]) {
            return CUSTOM_ERROR_SIGNATURES[signature];
        }
    }

    // PRIORITY 3: Check for decoded error name in cause.data
    if (err.cause?.data?.errorName) {
        const errorName = err.cause.data.errorName;
        if (CUSTOM_ERROR_NAMES[errorName]) {
            return CUSTOM_ERROR_NAMES[errorName];
        }
        return formatErrorName(errorName, err.cause.data.args);
    }

    // PRIORITY 4: Check for decoded error name in err.data
    if (err.data?.errorName) {
        const errorName = err.data.errorName;
        if (CUSTOM_ERROR_NAMES[errorName]) {
            return CUSTOM_ERROR_NAMES[errorName];
        }
        return formatErrorName(errorName, err.data.args);
    }

    // PRIORITY 5: Check the raw message for common Solidity require/revert strings
    if (err.message) {
        // Look for require/revert reason strings (multiple formats)
        const revertReasonMatch = err.message.match(/reverted with reason string ['"](.+?)['"]/i);
        if (revertReasonMatch) {
            return mapRevertReason(revertReasonMatch[1]);
        }

        // Also check for "reverted with the following reason:" format
        const followingReasonMatch = err.message.match(/reverted with the following reason:\s*(.+?)(?:\n|$)/i);
        if (followingReasonMatch) {
            return mapRevertReason(followingReasonMatch[1].trim());
        }

        // Check for known error strings directly in message
        if (err.message.includes('Insufficient collateral')) {
            return 'The escrow does not have enough collateral to release. This may indicate a data inconsistency with the loan. Please contact support.';
        }
        if (err.message.includes('Collateral already deposited')) {
            return 'Collateral has already been deposited for this offer. You may have already accepted this offer previously. Please check your dashboard for existing loans or refresh the page.';
        }
        if (err.message.includes('Price data is stale')) {
            return 'Price data is stale. Please refresh the price feed before proceeding.';
        }
        if (err.message.includes('Invalid price')) {
            return 'Invalid price data from oracle.';
        }
        if (err.message.includes('Price feed not updated')) {
            return 'Price feed has not been updated yet.';
        }
    }

    // Also check shortMessage directly for these common require strings
    if (err.shortMessage) {
        if (err.shortMessage.includes('Collateral already deposited')) {
            return 'Collateral has already been deposited for this offer. You may have already accepted this offer previously. Please check your dashboard for existing loans or refresh the page.';
        }
    }

    // PRIORITY 6: Check metaMessages for more context
    if (err.metaMessages && err.metaMessages.length > 0) {
        for (const msg of err.metaMessages) {
            if (msg.includes('ERC20InsufficientBalance')) {
                return 'Insufficient token balance. You need more tokens to complete this transaction.';
            }
            if (msg.includes('ERC20InsufficientAllowance')) {
                return 'Insufficient allowance. Please approve the token first.';
            }
            if (msg.includes('Price data is stale')) {
                return 'Price data is stale. Please refresh the price feed before proceeding.';
            }
            const requireMatch = msg.match(/require\(.*?,\s*['"](.+?)['"]\)/);
            if (requireMatch) {
                return requireMatch[1];
            }
        }
    }

    // PRIORITY 7: Fallback to shortMessage (but clean it up)
    if (err.shortMessage) {
        const msg = err.shortMessage;

        // Check for revert reason in shortMessage
        if (msg.includes('Price data is stale')) {
            return 'Price data is stale. Please refresh the price feed before proceeding.';
        }

        // Don't return raw "reverted with the following signature" messages
        if (msg.includes('reverted with the following signature')) {
            // We already checked signatures above, so return a generic message
            return 'Transaction would fail. Please check your balance and try again.';
        }

        // Extract revert reason if present
        const revertMatch = msg.match(/reverted[:\s]+(.+?)(?:\n|$)/i);
        if (revertMatch && revertMatch[1] && revertMatch[1].length < 200) {
            const reason = revertMatch[1].trim();
            // Don't return if it just contains "with the following signature"
            if (!reason.includes('with the following signature')) {
                return reason;
            }
        }

        // If shortMessage is clean, return it
        if (!msg.includes('signature') && msg.length < 200) {
            return msg;
        }
    }

    if (err.cause?.reason) {
        return err.cause.reason;
    }

    return err.message || 'Transaction simulation failed';
};

/**
 * Map require statement reasons to user-friendly messages
 */
const REQUIRE_REASON_MESSAGES: Record<string, string> = {
    'Insufficient collateral': 'The escrow does not have enough collateral to release. This may indicate a data inconsistency with the loan.',
    'Amount must be > 0': 'Amount must be greater than zero.',
    'Only for crypto loans': 'This operation is only available for crypto loans.',
    'Caller is not the marketplace': 'Only the marketplace contract can perform this action.',
    'Loan not found': 'The specified loan was not found.',
    'Insufficient collateral value for liquidation': 'The collateral value is insufficient for liquidation.',
    'Profit below minimum threshold': 'The liquidation profit is below the minimum required threshold.',
    'Insufficient collateral value': 'The collateral value is insufficient for this operation.',
    'Collateral already deposited': 'Collateral has already been deposited for this offer. You may have already accepted this offer previously. Please check your dashboard for existing loans or refresh the page.',
};

function mapRevertReason(reason: string): string {
    // Check for exact matches first
    if (REQUIRE_REASON_MESSAGES[reason]) {
        return REQUIRE_REASON_MESSAGES[reason];
    }
    // Check for partial matches
    for (const [key, message] of Object.entries(REQUIRE_REASON_MESSAGES)) {
        if (reason.toLowerCase().includes(key.toLowerCase())) {
            return message;
        }
    }
    // Return the original reason if no mapping found
    return reason;
}

/**
 * Format error name with arguments into readable message
 */
function formatErrorName(errorName: string, args?: unknown[]): string {
    // Convert camelCase/PascalCase to sentence
    const readable = errorName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

    if (args && args.length > 0) {
        // For ERC20InsufficientBalance, args are: (sender, balance, needed)
        if (errorName === 'ERC20InsufficientBalance' && args.length >= 3) {
            const balance = formatBigInt(args[1]);
            const needed = formatBigInt(args[2]);
            return `Insufficient balance. You have ${balance} but need ${needed}.`;
        }
    }

    return readable;
}

/**
 * Format BigInt for display
 */
function formatBigInt(value: unknown): string {
    if (typeof value === 'bigint') {
        // Rough formatting - divide by 1e18 for common token decimals
        const num = Number(value) / 1e18;
        if (num < 0.001) {
            return '< 0.001';
        }
        return num.toFixed(4);
    }
    return String(value);
}

/**
 * Simulate a contract write operation before executing it
 *
 * @param params - The contract parameters to simulate
 * @returns Object with simulation result and any errors
 *
 * @example
 * ```ts
 * const simulation = await simulateContractWrite({
 *   address: CONTRACT_ADDRESSES.loanMarketPlace,
 *   abi: LoanMarketPlaceABI,
 *   functionName: 'createLoanRequest',
 *   args: [collateralToken, collateralAmount, borrowAsset, borrowAmount, interestRate, duration],
 * });
 *
 * if (simulation.error) {
 *   toast.error(simulation.errorMessage);
 *   return;
 * }
 *
 * // Proceed with actual transaction
 * writeContract(simulation.request);
 * ```
 */
export async function simulateContractWrite(
    params: SimulateContractParameters
): Promise<{
    success: boolean;
    request?: unknown;
    error?: SimulationError;
    errorMessage?: string;
}> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await simulateContract(config, params as any);
        return {
            success: true,
            request: result.request,
        };
    } catch (err) {
        const error = err as SimulationError;
        const errorMessage = formatSimulationError(error);

        return {
            success: false,
            error,
            errorMessage,
        };
    }
}

/**
 * Common error messages for better UX
 */
export const ERROR_MESSAGES = {
    INSUFFICIENT_BALANCE: 'Insufficient token balance',
    INSUFFICIENT_ALLOWANCE: 'Please approve the token first',
    INVALID_AMOUNT: 'Invalid amount specified',
    INVALID_DURATION: 'Invalid loan duration',
    INVALID_INTEREST_RATE: 'Interest rate outside allowed range',
    ASSET_NOT_ENABLED: 'This asset is not enabled for lending',
    LTV_EXCEEDED: 'Borrow amount exceeds maximum LTV for this collateral',
    LOAN_NOT_FOUND: 'Loan not found',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    CONTRACT_PAUSED: 'The contract is currently paused',
} as const;
