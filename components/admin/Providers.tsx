"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@/components/admin/Toaster";

// Defaults pensados para Apps Script, que tarda 1–3 s por request:
//   staleTime 30 s      → no refetch en cada montaje
//   refetchOnWindowFocus false → cambiar de pestaña no dispara una ronda de
//                         requests (el operador del evento alterna mucho)
//   retry 1             → un reintento; más solo alarga la espera visible
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
