import { QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

// Singleton pattern to prevent multiple QueryClient instances
let queryClientInstance: QueryClient | null = null;

function createQueryClient() {
  if (queryClientInstance) {
    return queryClientInstance;
  }

  queryClientInstance = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof AxiosError) {
            const status = error.response?.status ?? 0;

            if (status >= 400 && status < 500) {
              return false;
            }
          }

          return failureCount < 4;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
      },
    },
  });

  return queryClientInstance;
}

export const queryClient = createQueryClient();
