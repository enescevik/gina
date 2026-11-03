import { QueryClient } from "@tanstack/react-query";

/** Tek QueryClient; çevrimdışı önbellek (persist) 2. haftada eklenir. */
export const queryClient = new QueryClient({
  defaultOptions: {
    // Mutations fail visibly. Only exam answers have a separate identity-scoped durable journal.
    mutations: { networkMode: "always" },
    queries: {
      staleTime: 30_000,
      networkMode: "always",
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
