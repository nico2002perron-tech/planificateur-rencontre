import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'financialmodelingprep.com' },
      { protocol: 'https', hostname: 'pbrergmetslmavqtmipx.supabase.co' },
      { protocol: 'https', hostname: 'vf-groupe-financier-ste-foy-v2nr.vercel.app' },
    ],
  },
};

export default nextConfig;
