/**
 * Root Gateway — src/app/page.tsx
 *
 * This file is required so that Vercel's Edge Network and Next.js file-system
 * router correctly serve the marketing landing page at the root path "/".
 *
 * The actual landing page component lives in src/app/(public)/page.tsx inside
 * a route group. Route groups are transparent to the router and do NOT
 * automatically promote their page.tsx to the parent route. Without this
 * explicit root page.tsx, navigating to the naked domain returns a 404 on
 * Vercel (and in any production deployment).
 *
 * DO NOT delete or move this file. All landing page UI/logic remains in
 * src/app/(public)/page.tsx — this file is purely a re-export gateway.
 */

export const dynamic = 'force-dynamic';

export default function Page() {
    return (
        <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '40px' }}>SchoolERP is Live!</h1>
            <p style={{ fontSize: '20px' }}>Deploying... please wait 2 mins and refresh.</p>
            <a href="/login" style={{ color: 'blue', fontSize: '18px' }}>Go to Login</a>
        </div>
    );
}