import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app is anonymous by design and posts only ageBand/locale/theme to the
  // single server entry point. Enforce the server-only boundary so provider /
  // SDK / sharp modules can never leak into client bundles.
  serverExternalPackages: ["sharp", "openai"],
};

export default withNextIntl(nextConfig);
