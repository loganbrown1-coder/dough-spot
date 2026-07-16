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
  async headers() {
    return [
      {
        // Every route - this is an authenticated dashboard, so nothing in
        // it should ever be framed by another site (clickjacking).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
        ],
      },
    ];
  },
};

export default nextConfig;
