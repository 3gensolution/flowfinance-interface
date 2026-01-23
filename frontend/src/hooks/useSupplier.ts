'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Address, Abi } from 'viem';
import { useEffect } from 'react';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { useInvalidateContractQueries } from './useContracts';
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
    },
  });

  // Parse the tuple result into a typed object
  const supplierData = result.data as readonly unknown[] | undefined;
  const supplier: SupplierDetails | undefined = supplierData ? {
    supplierAddress: supplierData[0] as Address,
    supplierType: Number(supplierData[1]),
    name: supplierData[2] as string,
    businessRegistrationNumber: supplierData[3] as string,
    kycDocumentHash: supplierData[4] as string,
    isVerified: supplierData[5] as boolean,
    isActive: supplierData[6] as boolean,
    registeredAt: supplierData[7] as bigint,
    totalLoansProvided: supplierData[8] as bigint,
    totalVolumeProvided: supplierData[9] as bigint,
    reputationScore: supplierData[10] as bigint,
    stakedAmount: supplierData[11] as bigint,
    averageRating: supplierData[12] as bigint,
    numberOfRatings: supplierData[13] as bigint,
  } : undefined;

  // Check if user is actually registered (has non-zero registeredAt)
  const isRegistered = supplier ? supplier.registeredAt > BigInt(0) : false;

  return {
    ...result,
    supplier,
    isRegistered,
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
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) invalidateAll();
  }, [isSuccess, invalidateAll]);

  const registerSupplier = async (
    supplierType: SupplierType,
    name: string,
    businessRegistrationNumber: string,
    kycDocumentHash: string,
    stakeAmount: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.supplierRegistry,
      abi: SupplierRegistryABI,
      functionName: 'registerSupplier',
      args: [supplierType, name, businessRegistrationNumber, kycDocumentHash],
      value: stakeAmount,
    });
  };

  return { registerSupplier, hash, isPending, isConfirming, isSuccess, error };
}

// Add stake
export function useAddStake() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) invalidateAll();
  }, [isSuccess, invalidateAll]);

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

// Withdraw stake
export function useWithdrawStake() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) invalidateAll();
  }, [isSuccess, invalidateAll]);

  const withdrawStake = async (amount: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.supplierRegistry,
      abi: SupplierRegistryABI,
      functionName: 'withdrawStake',
      args: [amount],
    });
  };

  return { withdrawStake, hash, isPending, isConfirming, isSuccess, error };
}
