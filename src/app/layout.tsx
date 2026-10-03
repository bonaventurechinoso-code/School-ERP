import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Multi-Tenant School ERP",
  description: "Production-grade multi-tenant school ERP system",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "School ERP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="School ERP" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        {/* Apple Touch Startup / Splash Screen for iOS devices */}
        <link rel="apple-touch-startup-image" href="/icon-512.png" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/icon-512.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />
        <meta name="theme-color" content="#4A90E2" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://bonaveeict.com.ng https://*.bonaveeict.com.ng https://school-erp-1-mfc3.onrender.com https://*.onrender.com http://localhost:* http://127.0.0.1:* ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://bonaveeict.com.ng https://*.bonaveeict.com.ng; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; worker-src 'self' blob:; manifest-src 'self' https://bonaveeict.com.ng https://*.bonaveeict.com.ng;"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  var prodBaseUrl = (window.location.origin.indexOf('bonaveeict.com.ng') !== -1 || window.location.origin.indexOf('onrender.com') !== -1)
                    ? window.location.origin
                    : '${process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng"}';

                  try {
                    window.localStorage.setItem('schoolerp_api_base_url', prodBaseUrl);
                  } catch (e) {}

                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      var swUrl = '/sw.js?apiUrl=' + encodeURIComponent(prodBaseUrl);
                      navigator.serviceWorker.register(swUrl, { scope: '/' })
                        .then(function(registration) {
                          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
                          if (registration.active) {
                            registration.active.postMessage({ type: 'SYNC_API_BASE', apiUrl: prodBaseUrl });
                          }
                        })
                        .catch(function(error) {
                          console.error('[PWA] Service Worker registration failed:', error);
                        });
                    });
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-slate-50 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
