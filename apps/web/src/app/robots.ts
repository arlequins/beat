import type { MetadataRoute } from "next";

import { siteUrl } from "~/config/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", userAgent: "*" },
    sitemap: siteUrl("sitemap.xml"),
  };
}
