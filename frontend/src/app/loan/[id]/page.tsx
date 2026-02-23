'use client';

import { useParams } from 'next/navigation';
import { useLoanRequestMultiChain } from '@/hooks/useContracts';
import { LoanRequestStatus } from '@/types';
import { getActiveChainId, getTokensForChain } from '@/config/contracts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { XCircle } from 'lucide-react';
import Link from 'next/link';
import SameChainLoanDetail from '@/components/loan/SameChainLoanDetail';
import CrossChainLoanDetail from '@/components/loan/CrossChainLoanDetail';
import type { ParsedLoanRequest } from '@/components/loan/SameChainLoanDetail';

export default function LoanDetailPage() {
  const params = useParams();
  const requestId = params.id ? BigInt(params.id as string) : undefined;

  // Fetch loan request from ALL configured chains (active chain checked first).
  // This ensures the page works regardless of which chain the user's wallet is on.
  const { data: requestData, foundChainId, isLoading: requestLoading } = useLoanRequestMultiChain(requestId);

  // Parse request data from contract tuple
  const requestTuple = requestData as readonly unknown[];
  const request: ParsedLoanRequest | null = requestData ? {
    requestId: requestTuple[0] as bigint,
    borrower: requestTuple[1] as `0x${string}`,
    collateralAmount: requestTuple[2] as bigint,
    collateralToken: requestTuple[3] as `0x${string}`,
    borrowAsset: requestTuple[4] as `0x${string}`,
    borrowAmount: requestTuple[5] as bigint,
    duration: requestTuple[6] as bigint,
    maxInterestRate: requestTuple[7] as bigint,
    interestRate: requestTuple[8] as bigint,
    createdAt: requestTuple[9] as bigint,
    expireAt: requestTuple[10] as bigint,
    status: requestTuple[11] as LoanRequestStatus,
    chainId: requestTuple[12] as bigint,
  } : null;

  // Cross-chain detection — check against the chain where the request was FOUND:
  // Method 1: chainId field in the request differs from the chain it lives on
  // Method 2: borrowAsset or collateralToken not in the found chain's token list
  const activeChainId = getActiveChainId();
  const chainIdMismatch = request?.chainId !== undefined
    && Number(request.chainId) !== 0
    && Number(request.chainId) !== foundChainId;

  const foundChainTokens = getTokensForChain(foundChainId);
  const foundChainTokenAddresses = Object.values(foundChainTokens).map(
    (t) => t.address.toLowerCase()
  );
  const hasForeignTokens = request
    ? (
      !foundChainTokenAddresses.includes(request.borrowAsset.toLowerCase()) ||
      !foundChainTokenAddresses.includes(request.collateralToken.toLowerCase())
    )
    : false;
  const isCrossChainRequest = chainIdMismatch || hasForeignTokens;

  // Request lives on a different chain than the user's active marketplace chain
  const isRemoteChain = foundChainId !== activeChainId;

  if (requestLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Invalid/not found
  if (!request || !request.borrower || request.borrower === '0x0000000000000000000000000000000000000000' || request.borrowAmount === BigInt(0)) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Request Not Found</h2>
          <p className="text-gray-400 mb-6">
            This loan request doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (requestId === undefined) return null;

  // Route to the appropriate component.
  // CrossChainLoanDetail handles both genuinely cross-chain AND remote same-chain requests
  // (it manages chain switching, balance reads from target chain, etc.)
  // The `isCrossChain` prop controls whether cross-chain UI (banner, tags) is shown.
  if (isCrossChainRequest || isRemoteChain) {
    return (
      <CrossChainLoanDetail
        request={request}
        requestId={requestId}
        foundOnChainId={foundChainId}
        isCrossChain={isCrossChainRequest}
      />
    );
  }

  return <SameChainLoanDetail request={request} requestId={requestId} />;
}
