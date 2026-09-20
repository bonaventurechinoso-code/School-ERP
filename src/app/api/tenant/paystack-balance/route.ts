import { NextRequest, NextResponse } from "next/server";
import { safeRedisGet, safeRedisSet } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// In-memory cache fallback: maps key -> { data, expiresAt }
interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
}
const memoryCache = new Map<string, MemoryCacheEntry>();

const CACHE_TTL_SECONDS = 60; // 60 seconds server-side sliding cache

/**
 * GET /api/tenant/paystack-balance
 * Returns cached Paystack subaccount/tenant balance.
 * Caches responses for 60 seconds to eliminate live external network handshakes on every page load.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subaccountCode = searchParams.get("subaccountCode") || "default";
    const schoolId = searchParams.get("schoolId");

    const cacheKey = `cache:paystack:balance:${subaccountCode}:${schoolId || "global"}`;

    // 1. Check in-memory cache first (< 0.1ms)
    const memEntry = memoryCache.get(cacheKey);
    const now = Date.now();
    if (memEntry && memEntry.expiresAt > now) {
      return NextResponse.json({
        success: true,
        cached: true,
        source: "memory-cache",
        ...memEntry.data,
      }, {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
          "X-Cache": "HIT-MEMORY",
        },
      });
    }

    // 2. Check Redis cache (< 2ms)
    try {
      const redisData = await safeRedisGet(cacheKey);
      if (redisData) {
        const parsed = JSON.parse(redisData);
        // Refresh local memory cache
        memoryCache.set(cacheKey, { data: parsed, expiresAt: now + CACHE_TTL_SECONDS * 1000 });
        return NextResponse.json({
          success: true,
          cached: true,
          source: "redis-cache",
          ...parsed,
        }, {
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
            "X-Cache": "HIT-REDIS",
          },
        });
      }
    } catch {
      // Non-blocking: proceed to fresh retrieval
    }

    // 3. Fetch fresh balance (from Paystack API or tenant ledger balance)
    let balanceNgn = 0;
    let currency = "NGN";
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (paystackSecret && subaccountCode && subaccountCode !== "default") {
      try {
        const response = await fetch(`https://api.paystack.co/balance`, {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
          next: { revalidate: 60 },
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.status && Array.isArray(resJson.data)) {
            const ngnBalance = resJson.data.find((b: any) => b.currency === "NGN");
            if (ngnBalance) {
              balanceNgn = Number(ngnBalance.balance) / 100; // Paystack sends amounts in kobo
              currency = ngnBalance.currency;
            }
          }
        }
      } catch {
        // Handshake timeout or offline fallback
      }
    }

    // Fallback: If no direct balance from external gateway, compute from tenant's verified payments
    if (balanceNgn === 0 && schoolId) {
      try {
        const verifiedSum = await prisma.payment.aggregate({
          where: { schoolId },
          _sum: { amountPaid: true },
        });
        balanceNgn = Number(verifiedSum._sum.amountPaid || 0);
      } catch {}
    }

    const payload = {
      balance: balanceNgn,
      currency,
      subaccountCode,
      schoolId: schoolId || null,
      updatedAt: new Date().toISOString(),
    };

    // 4. Populate in-memory and Redis caches with 60-second TTL
    memoryCache.set(cacheKey, { data: payload, expiresAt: now + CACHE_TTL_SECONDS * 1000 });
    safeRedisSet(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS).catch(() => {});

    return NextResponse.json({
      success: true,
      cached: false,
      source: "live-fetch",
      ...payload,
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
        "X-Cache": "MISS",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve balance." },
      { status: 500 }
    );
  }
}
