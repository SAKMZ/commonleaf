import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // `standalone` produces a self-contained server bundle, which is what the
  // Docker image copies. It is ignored by Vercel.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,

  // Notes and images are served from the user's own repository through our own
  // route handlers, so no remote image hosts are needed.
  images: { remotePatterns: [] },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
