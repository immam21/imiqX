/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid intermittent ENOENT on .next/cache/webpack/*.pack.gz in local dev.
      config.cache = false
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  async headers() {
    const headers = [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },

    ]

    if (process.env.NODE_ENV !== 'production') {
      headers.push({
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
      })
    }

    return headers
  },
}

module.exports = nextConfig
