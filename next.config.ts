import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "liar-game";
const basePath = isProduction ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath,
  assetPrefix: isProduction ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
