/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  devIndicators: false,

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '192.168.1.231:3000',
        '192.168.0.139:3000',
        '192.168.1.232:3000',
        'signox-frontend.onrender.com',
      ],
    },
  },

  images: {
    domains: [
      'localhost',
      '192.168.1.231',
      '192.168.0.139',
      '192.168.1.232',
      'signox-backend.onrender.com',
    ],
  },

  // Output standalone for better performance on Render
  output: 'standalone',

  // Disable telemetry in production
  ...(process.env.NODE_ENV === 'production' && {
    productionBrowserSourceMaps: false,
  }),
};

module.exports = nextConfig;
