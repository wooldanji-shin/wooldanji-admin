"use client";

import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cssVariablesResolver, theme } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  // 공용 목록(lib/hooks/useLookups) 캐시 — 창으로 돌아올 때마다 다시 받지는 않는다
  const [queryClient] = useState<QueryClient>(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="light"
      >
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
