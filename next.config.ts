import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Configure API routes for large file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Allow up to 100MB file uploads
    },
  },
};

export default nextConfig;
