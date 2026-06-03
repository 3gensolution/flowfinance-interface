'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function invalidateLeaderboardQueries(
  invalidate: ReturnType<typeof useQueryClient>['invalidateQueries'],
  walletAddress?: string,
) {
  void invalidate({ queryKey: ['leaderboard'] });

  if (walletAddress) {
    void invalidate({ queryKey: ['leaderboard', 'me', walletAddress] });
  }
}

export function useInvalidateLeaderboardOnSuccess(isSuccess: boolean, walletAddress?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSuccess) return;

    const delays = [0, 5_000, 15_000, 35_000];

    const timers = delays.map((delay) =>
      window.setTimeout(() => {
        invalidateLeaderboardQueries(queryClient.invalidateQueries.bind(queryClient), walletAddress);
      }, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isSuccess, queryClient, walletAddress]);
}
