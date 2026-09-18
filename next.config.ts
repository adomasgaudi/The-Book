import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// GitHub Pages serves the site from /<repo-name>/ — the workflow passes it in.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  // Versija rodoma prie pavadinimo — atnaujinama su kiekvienu commit'u (package.json).
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
