import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, which real phone camera photos blow past almost
      // immediately. Photos are also compressed client-side before upload
      // (see lib/compressImage.ts), so this is a safety net, not the only
      // thing keeping requests small.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
