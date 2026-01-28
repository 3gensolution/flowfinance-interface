import { QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

export const queryClient = new QueryClient({
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
