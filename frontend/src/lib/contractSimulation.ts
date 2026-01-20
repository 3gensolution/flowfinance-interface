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
    // Check for decoded error name in cause.data
    if (err.cause?.data?.errorName) {
        const errorName = err.cause.data.errorName;
        if (CUSTOM_ERROR_NAMES[errorName]) {
            return CUSTOM_ERROR_NAMES[errorName];
        }
        // Format the error name nicely if not in our map
        return formatErrorName(errorName, err.cause.data.args);
    }

    // Check for decoded error name in err.data
    if (err.data?.errorName) {
        const errorName = err.data.errorName;
        if (CUSTOM_ERROR_NAMES[errorName]) {
            return CUSTOM_ERROR_NAMES[errorName];
        }
        return formatErrorName(errorName, err.data.args);
    }

    // Check for error signature in the message
    const signatureMatch = err.message?.match(/0x[a-fA-F0-9]{8}/);
    if (signatureMatch) {
        const signature = signatureMatch[0].toLowerCase();
        if (CUSTOM_ERROR_SIGNATURES[signature]) {
            return CUSTOM_ERROR_SIGNATURES[signature];
        }
    }

    // Check cause signature
    if (err.cause?.signature) {
        const signature = err.cause.signature.toLowerCase();
        if (CUSTOM_ERROR_SIGNATURES[signature]) {
            return CUSTOM_ERROR_SIGNATURES[signature];
        }
    }

    // Check metaMessages for more context
    if (err.metaMessages && err.metaMessages.length > 0) {
        // Look for useful info in metaMessages
        for (const msg of err.metaMessages) {
            if (msg.includes('ERC20InsufficientBalance')) {
                return 'Insufficient token balance. You need more tokens to complete this transaction.';
            }
            if (msg.includes('ERC20InsufficientAllowance')) {
                return 'Insufficient allowance. Please approve the token first.';
            }
            if (msg.includes('Price data is stale')) {
                return 'Price data is stale. Please wait for price feeds to be refreshed.';
            }
        }
    }

    // Fallback to shortMessage
    if (err.shortMessage) {
        // Clean up common patterns
        const msg = err.shortMessage;

        // Extract custom error info if present
        if (msg.includes('reverted with the following signature')) {
            const sigMatch = msg.match(/0x[a-fA-F0-9]{8}/);
            if (sigMatch && CUSTOM_ERROR_SIGNATURES[sigMatch[0].toLowerCase()]) {
                return CUSTOM_ERROR_SIGNATURES[sigMatch[0].toLowerCase()];
            }
        }

        return msg;
    }

    if (err.cause?.reason) {
        return err.cause.reason;
    }

    return err.message || "Contract simulation failed";
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
