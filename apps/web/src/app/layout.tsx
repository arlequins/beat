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

export const viewport: Viewport = {
  themeColor: "#111326",
  viewportFit: "cover",
};

const themeBootstrap = `(() => {
  const root = document.documentElement;
  const segments = location.pathname.split("/").filter(Boolean);
  const fictionIndex = segments.lastIndexOf("fiction");
  const isFictionReader =
    fictionIndex >= 0 &&
    fictionIndex === segments.length - 2 &&
    segments[fictionIndex + 1] !== "guide";
  let siteTheme = matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  try {
    const savedSiteTheme = localStorage.getItem("arlequin-theme");
    if (savedSiteTheme === "dark" || savedSiteTheme === "light") {
      siteTheme = savedSiteTheme;
    }
  } catch {
    // Use the device appearance when site storage is unavailable.
  }

  root.classList.add(siteTheme);
  if (!isFictionReader) return;

  let readerTheme = "night";
  try {
    const saved = JSON.parse(
      localStorage.getItem("beat-fiction-v1-preferences") || "null",
    );
    if (["paper", "white", "night"].includes(saved?.theme)) {
      readerTheme = saved.theme;
    }
  } catch {
    // Fiction defaults to night when reader settings are unavailable.
  }

  root.dataset.readerTheme = readerTheme;
  const surface =
    readerTheme === "night"
      ? "#000000"
      : readerTheme === "white"
        ? "#ffffff"
        : "#f5f0e6";
  const themeColors = document.querySelectorAll('meta[name="theme-color"]');
  if (themeColors.length > 0) {
    root.dataset.siteThemeColor = themeColors[0].content;
    themeColors.forEach((themeColor) => {
      themeColor.content = surface;
    });
  }
})();`;

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrap,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <AppShell>{props.children}</AppShell>
      </body>
    </html>
  );
}
