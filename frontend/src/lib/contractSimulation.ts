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
    'ERC20InsufficientBalance': 'Insufficient token balance. You need more tokens to complete this transaction.',
    'ERC20InsufficientAllowance': 'Insufficient allowance. Please approve the token first.',
    'OwnableUnauthorizedAccount': 'You are not authorized to perform this action.',
    'OwnableInvalidOwner': 'Invalid owner address.',
    'AccessControlUnauthorizedAccount': 'You do not have the required role to perform this action.',
    'InvalidAmount': 'Invalid amount specified.',
    'InvalidDuration': 'Invalid loan duration.',
    'InvalidInterestRate': 'Interest rate outside allowed range.',
    'AssetNotEnabled': 'This asset is not enabled for lending.',
    'LTVExceeded': 'Borrow amount exceeds maximum LTV for this collateral.',
    'LoanNotFound': 'Loan not found.',
    'PriceDataStale': 'Price data is stale. Please wait for price feeds to be refreshed.',
    'PriceFeedNotSet': 'Price feed not configured for this token.',
    'InvalidPrice': 'Invalid price returned from oracle.',
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
        // Look for require/revert reason strings
        const revertReasonMatch = err.message.match(/reverted with reason string ['"](.+?)['"]/i);
        if (revertReasonMatch) {
            return revertReasonMatch[1];
        }

        // Check for known error strings directly in message
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
