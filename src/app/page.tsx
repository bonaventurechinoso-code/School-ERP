/**
 * Root Gateway - src/app/page.tsx
 * Re-exports the marketing landing page at "/"
 * All UI stays in src/app/(public)/page.tsx
 */
export const dynamic = 'force-dynamic';
export { default } from "./(public)/page";
