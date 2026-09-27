import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import webpush from 'web-push';

// Configure VAPID Details
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@bonaveeict.com.ng';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[WebPush] Error configuring VAPID details:', err);
  }
}

/**
 * GET /api/notifications/push
 * Health check & returns public key for client ServiceWorker registration
 */
export async function GET() {
  const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  return NextResponse.json({
    status: 'ok',
    configured: isConfigured,
    publicKey: isConfigured ? VAPID_PUBLIC_KEY : null,
  });
}

/**
 * POST /api/notifications/push
 * Dispatches a push notification to a client's PushSubscription
 */
export async function POST(request: NextRequest) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'VAPID keys are not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment.',
        },
        { status: 500 }
      );
    }

    const payload = await request.json();
    const {
      subscription,
      title = 'School ERP Alert',
      body = 'This is a sample test notification from the School ERP system.',
      url = '/',
      icon = '/icon-192.png',
      badge = '/icon-192.png',
      data,
    } = payload;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid subscription object in request payload. Expected { endpoint, keys: { p256dh, auth } }',
        },
        { status: 400 }
      );
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon,
      badge,
      url,
      data: data || {},
    });

    // Send push notification via web-push
    const result = await webpush.sendNotification(
      subscription,
      notificationPayload,
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'high',
      }
    );

    return NextResponse.json({
      success: true,
      statusCode: result.statusCode,
      message: 'Push notification dispatched successfully.',
    });
  } catch (error: any) {
    console.error('[WebPush] Failed to send push notification:', error);

    // Expired or unsubscribed endpoint handling (404 / 410)
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription has expired or is no longer active.',
          statusCode: error.statusCode,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to dispatch push notification.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
