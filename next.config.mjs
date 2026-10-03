/** @type {import('next').NextConfig} */
const nextConfig = {
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
        source: '/super-admin',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/superadmin',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/super-admin/:path*',
        destination: '/admin/:path*',
        permanent: false,
      },
      {
        source: '/superadmin/:path*',
        destination: '/admin/:path*',
        permanent: false,
      },
      {
        source: '/admin/login',
        destination: '/login?callbackUrl=/admin',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
