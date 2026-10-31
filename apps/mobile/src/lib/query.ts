import { QueryClient } from "@tanstack/react-query";

/** Tek QueryClient; çevrimdışı önbellek (persist) 2. haftada eklenir. */
export const queryClient = new QueryClient({
  defaultOptions: {
    // No durable offline outbox: saves fail visibly instead of being silently queued across accounts.
    mutations: { networkMode: "always" },
    queries: {
      staleTime: 30_000,
      networkMode: "always",
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
