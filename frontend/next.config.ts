import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Only set turbopack root for local dev where multiple lockfiles might exist
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: path.resolve(__dirname),
        },
      }),
};

export default nextConfig;
