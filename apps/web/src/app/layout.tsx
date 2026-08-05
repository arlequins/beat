import type { Metadata, Viewport } from "next";

import { AppShell } from "~/components/blog/app-shell";
import { siteConfig } from "~/config/site";

import "~/app/styles.css";

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.description,
    images: [
      {
        alt: "Arlequin × Lumen — Human direction, AI illumination",
        height: 941,
        url: "/og-arlequin-lumen.png",
        width: 1672,
      },
    ],
    siteName: siteConfig.name,
    title: siteConfig.name,
    type: "website",
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-arlequin-lumen.png"],
    title: siteConfig.name,
  },
};

export const viewport: Viewport = { themeColor: "#111326" };

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("arlequin-theme"); const theme = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.classList.add(theme); } catch { document.documentElement.classList.add("light"); } })();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AppShell>{props.children}</AppShell>
      </body>
    </html>
  );
}
