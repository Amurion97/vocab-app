import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  reactCompiler: true,
}

export default nextConfig
