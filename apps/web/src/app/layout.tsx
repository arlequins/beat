import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";
import type { Metadata, Viewport } from "next";

import { OidcAuthProvider } from "~/auth/provider";
import { AppShell } from "~/components/blog/app-shell";
import { siteConfig } from "~/config/site";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <ThemeProvider>
          <OidcAuthProvider>
            <TRPCReactProvider>
              <AppShell>{props.children}</AppShell>
            </TRPCReactProvider>
          </OidcAuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
