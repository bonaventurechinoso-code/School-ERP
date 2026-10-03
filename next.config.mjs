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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://bonaveeict.com.ng https://*.bonaveeict.com.ng https://school-erp-1-mfc3.onrender.com https://*.onrender.com http://localhost:* http://127.0.0.1:* ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://bonaveeict.com.ng https://*.bonaveeict.com.ng; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; worker-src 'self' blob:; manifest-src 'self' https://bonaveeict.com.ng https://*.bonaveeict.com.ng;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
