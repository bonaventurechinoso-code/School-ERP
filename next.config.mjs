/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdfkit'],
  experimental: {
    isrMemoryCacheSize: 0,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/super-admin',
        permanent: false,
      },
      {
        source: '/admin/:path*',
        destination: '/super-admin/:path*',
        permanent: false,
      },
      {
        source: '/superadmin',
        destination: '/super-admin',
        permanent: false,
      },
      {
        source: '/superadmin/:path*',
        destination: '/super-admin/:path*',
        permanent: false,
      },
      {
        source: '/admin/login',
        destination: '/login?callbackUrl=/super-admin',
        permanent: false,
      },
      {
        source: '/super-admin/login',
        destination: '/login?callbackUrl=/super-admin',
        permanent: false,
      },
      {
        source: '/bursar-portal',
        destination: '/bursar',
        permanent: false,
      },
      {
        source: '/:schoolDomain/bursar-portal',
        destination: '/:schoolDomain/finance/bursar-workspace',
        permanent: false,
      },
      {
        source: '/:schoolDomain/finance/bursar-portal',
        destination: '/:schoolDomain/finance/bursar-workspace',
        permanent: false,
      },
      {
        source: '/:schoolDomain/bank',
        destination: '/:schoolDomain/finance/bank-account',
        permanent: false,
      },
      {
        source: '/:schoolDomain/finance',
        destination: '/:schoolDomain/finance/bursar-workspace',
        permanent: false,
      },
      {
        source: '/:schoolDomain/teachers',
        destination: '/:schoolDomain/staff?filter=teaching',
        permanent: false,
      },
      {
        source: '/admin/subscriptions',
        destination: '/admin/billings',
        permanent: false,
      },
      {
        source: '/admin/finance',
        destination: '/admin/bank',
        permanent: false,
      },
      {
        source: '/admin/users',
        destination: '/admin/audit-logs',
        permanent: false,
      },
      {
        source: '/admin/communications',
        destination: '/admin/support',
        permanent: false,
      },
      {
        source: '/:schoolDomain/parent/children',
        destination: '/:schoolDomain/parents',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
