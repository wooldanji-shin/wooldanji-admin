"use client";

import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { cssVariablesResolver, theme } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="light"
    >
      <ModalsProvider>{children}</ModalsProvider>
    </MantineProvider>
  );
}
