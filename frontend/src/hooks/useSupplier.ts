'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { Address, Abi } from 'viem';
import { useState } from 'react';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import SupplierRegistryABIJson from '@/contracts/SupplierRegistryABI.json';

const SupplierRegistryABI = SupplierRegistryABIJson as Abi;

// Supplier types matching the contract enum
export enum SupplierType {
  INDIVIDUAL = 0,
  BUSINESS = 1,
}

export interface SupplierDetails {
  supplierAddress: Address;
  supplierType: number;
  name: string;
  businessRegistrationNumber: string;
  kycDocumentHash: string;
  isVerified: boolean;
  isActive: boolean;
  registeredAt: bigint;
  totalLoansProvided: bigint;
  totalVolumeProvided: bigint;
  reputationScore: bigint;
  stakedAmount: bigint;
  averageRating: bigint;
  numberOfRatings: bigint;
}

// Get supplier details for an address
export function useSupplierDetails(address: Address | undefined) {
  const result = useReadContract({
    address: CONTRACT_ADDRESSES.supplierRegistry,
    abi: SupplierRegistryABI,
    functionName: 'getSupplierDetails',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && CONTRACT_ADDRESSES.supplierRegistry !== '0x0000000000000000000000000000000000000000',
      // Retry on error to handle temporary network issues, but not contract reverts
      retry: (failureCount, error) => {
        // Don't retry if it's a "Supplier not registered" error
        const errorMessage = (error as Error)?.message || '';
        if (errorMessage.includes('Supplier not registered')) {
          return false;
        }
        return failureCount < 2;
      },
    },
  });

  // Check if the error is "Supplier not registered" - this means user is not registered
  const isNotRegisteredError = result.error?.message?.includes('Supplier not registered') ||
    result.error?.message?.includes('revert');

  // Parse the struct result - wagmi returns structs as objects with named properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = result.data as any;

  // Handle both object format (wagmi) and array format (legacy)
  let supplier: SupplierDetails | undefined = undefined;

  if (rawData) {
    // Check if it's an object with named properties (wagmi struct format)
    if (typeof rawData === 'object' && 'supplierAddress' in rawData) {
      supplier = {
        supplierAddress: rawData.supplierAddress as Address,
        supplierType: Number(rawData.supplierType),
        name: rawData.name as string,
        businessRegistrationNumber: rawData.businessRegistrationNumber as string,
        kycDocumentHash: rawData.kycDocumentHash as string,
        isVerified: rawData.isVerified as boolean,
        isActive: rawData.isActive as boolean,
        registeredAt: BigInt(rawData.registeredAt || 0),
        totalLoansProvided: BigInt(rawData.totalLoansProvided || 0),
        totalVolumeProvided: BigInt(rawData.totalVolumeProvided || 0),
        reputationScore: BigInt(rawData.reputationScore || 0),
        stakedAmount: BigInt(rawData.stakedAmount || 0),
        averageRating: BigInt(rawData.averageRating || 0),
        numberOfRatings: BigInt(rawData.numberOfRatings || 0),
      };
    }
    // Array format fallback
    else if (Array.isArray(rawData) && rawData.length >= 14) {
      supplier = {
        supplierAddress: rawData[0] as Address,
        supplierType: Number(rawData[1]),
        name: rawData[2] as string,
        businessRegistrationNumber: rawData[3] as string,
        kycDocumentHash: rawData[4] as string,
        isVerified: rawData[5] as boolean,
        isActive: rawData[6] as boolean,
        registeredAt: BigInt(rawData[7] || 0),
        totalLoansProvided: BigInt(rawData[8] || 0),
        totalVolumeProvided: BigInt(rawData[9] || 0),
        reputationScore: BigInt(rawData[10] || 0),
        stakedAmount: BigInt(rawData[11] || 0),
        averageRating: BigInt(rawData[12] || 0),
        numberOfRatings: BigInt(rawData[13] || 0),
      };
    }
  }

  // Check if user is actually registered:
  // - If we have supplier data with non-zero registeredAt, they're registered
  // - If we got a "Supplier not registered" error, they're not registered
  // - If loading or other error, we don't know yet
  const isRegistered = supplier ? supplier.registeredAt > BigInt(0) : false;

  return {
    ...result,
    supplier,
    isRegistered,
    isNotRegisteredError,
    isVerified: supplier?.isVerified ?? false,
    isActive: supplier?.isActive ?? false,
  };
}

// Get minimum supplier stake
export function useMinimumSupplierStake() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.supplierRegistry,
    abi: SupplierRegistryABI,
    functionName: 'minimumSupplierStake',
    query: {
      enabled: CONTRACT_ADDRESSES.supplierRegistry !== '0x0000000000000000000000000000000000000000',
    },
  });
}

// Get active suppliers
export function useActiveSuppliers() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.supplierRegistry,
    abi: SupplierRegistryABI,
    functionName: 'getActiveSuppliers',
    query: {
      enabled: CONTRACT_ADDRESSES.supplierRegistry !== '0x0000000000000000000000000000000000000000',
    },
  });
}

// Register as a supplier
export function useRegisterSupplier() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const registerSupplier = async (
    supplierType: SupplierType,
    name: string,
    businessRegistrationNumber: string
  ) => {
    setSimulationError(null);

    // Check if contract address is valid
    if (CONTRACT_ADDRESSES.supplierRegistry === '0x0000000000000000000000000000000000000000') {
      const error = 'Supplier Registry contract address is not configured';
      setSimulationError(error);
      throw new Error(error);
    }

    // Check if user is connected
    if (!address) {
      const error = 'Wallet not connected';
      setSimulationError(error);
      throw new Error(error);
    }

    // Simulate the transaction first
    setIsSimulating(true);
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.supplierRegistry,
          abi: SupplierRegistryABI,
          functionName: 'registerSupplier',
          args: [supplierType, name, businessRegistrationNumber],
          account: address,
        });
      }
    } catch (simError) {
      setIsSimulating(false);
      const errorMessage = (simError as Error)?.message || 'Transaction simulation failed';
      // Extract meaningful error message
      let userFriendlyError = 'Transaction would fail';
      if (errorMessage.includes('Already registered')) {
        userFriendlyError = 'You are already registered as a supplier';
      } else if (errorMessage.includes('Name required')) {
        userFriendlyError = 'Name is required';
      } else if (errorMessage.includes('Business registration number required')) {
        userFriendlyError = 'Business registration number is required for business accounts';
      }
      setSimulationError(userFriendlyError);
      throw new Error(userFriendlyError);
    }
    setIsSimulating(false);

    // If simulation passed, execute the transaction
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.supplierRegistry,
      abi: SupplierRegistryABI,
      functionName: 'registerSupplier',
      args: [supplierType, name, businessRegistrationNumber],
    });
  };

  return {
    registerSupplier,
    hash,
    isPending: isPending || isSimulating,
    isConfirming,
    isSuccess,
    error: error || (simulationError ? new Error(simulationError) : null),
    simulationError,
    isSimulating
  };
}

// Add stake
export function useAddStake() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addStake = async (amount: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.supplierRegistry,
      abi: SupplierRegistryABI,
      functionName: 'addStake',
      value: amount,
    });
  };

  return { addStake, hash, isPending, isConfirming, isSuccess, error };
}

// Withdraw stake (no amount param - withdraws full stake)
export function useWithdrawStake() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdrawStake = async () => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.supplierRegistry,
      abi: SupplierRegistryABI,
      functionName: 'withdrawStake',
    });
  };

  return { withdrawStake, hash, isPending, isConfirming, isSuccess, error };
}
