import type { Metadata, Viewport } from "next";

import { AppShell } from "~/components/blog/app-shell";
import { siteConfig, siteUrl } from "~/config/site";

import "~/app/styles.css";

const iconBase = process.env.GITHUB_PAGES === "true" ? "/beat" : "";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: `${iconBase}/favicon.ico?v=2`, sizes: "16x16 32x32 48x48" },
      {
        url: `${iconBase}/favicon.svg?v=2`,
        type: "image/svg+xml",
        sizes: "any",
      },
    ],
    apple: {
      url: `${iconBase}/apple-touch-icon.png`,
      sizes: "180x180",
      type: "image/png",
    },
  },
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.description,
    images: [
      {
        alt: "Arlequin × Lumen — Human direction, AI illumination",
        height: 941,
        url: siteUrl("og-arlequin-lumen.png"),
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
    images: [siteUrl("og-arlequin-lumen.png")],
    title: siteConfig.name,
  },
};

export const viewport: Viewport = { themeColor: "#111326" };

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("arlequin-theme"); const theme = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.classList.add(theme); } catch { document.documentElement.classList.add("light"); } })();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <AppShell>{props.children}</AppShell>
      </body>
    </html>
  );
}
