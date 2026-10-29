import { QueryClient } from "@tanstack/react-query";

/** Tek QueryClient; çevrimdışı önbellek (persist) 2. haftada eklenir. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
