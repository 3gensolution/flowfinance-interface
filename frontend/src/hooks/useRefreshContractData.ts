'use client';

import { useState, useCallback } from 'react';
import { queryClient } from '@/lib/react-query-client';

export function useRefreshContractData() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    isRefreshing,
    refresh,
  };
}
