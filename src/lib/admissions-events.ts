import { EventEmitter } from "events";
import { sendInquiryAcknowledgmentEmail } from "./email-service";

/**
 * Global singleton event emitter for Admissions lifecycle events.
 * Handles background event emission without blocking client requests.
 */
class AdmissionsEventManager extends EventEmitter {
  private static instance: AdmissionsEventManager;
  private dispatchedEventsCache = new Map<string, number>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    super();
    this.setMaxListeners(50);
    this.setupListeners();
  }

  public static getInstance(): AdmissionsEventManager {
    if (!AdmissionsEventManager.instance) {
      if ((globalThis as any).__admissionsEventManager) {
        AdmissionsEventManager.instance = (globalThis as any).__admissionsEventManager;
      } else {
        AdmissionsEventManager.instance = new AdmissionsEventManager();
        (globalThis as any).__admissionsEventManager = AdmissionsEventManager.instance;
      }
    }
    return AdmissionsEventManager.instance;
  }

  private setupListeners() {
    this.on("lead.inquiry", (payload: { leadId: string; schoolId?: string; lead?: any; school?: any }) => {
      // Execute asynchronously in a non-blocking microtask
      setImmediate(async () => {
        try {
          await sendInquiryAcknowledgmentEmail({
            lead: payload.lead,
            leadId: payload.leadId,
            school: payload.school,
            schoolId: payload.schoolId,
          });
        } catch (error) {
          console.error("[ADMISSIONS_EVENT_MANAGER] Error processing inquiry email event:", error);
        }
      });
    });
  }

  /**
   * Dispatches an inquiry notification event if not already sent recently.
   */
  public triggerInquiryNotification(params: {
    leadId: string;
    schoolId?: string;
    lead?: any;
    school?: any;
    force?: boolean;
  }) {
    const { leadId, schoolId, lead, school, force } = params;
    if (!leadId) return;

    const cacheKey = `inquiry:${leadId}`;
    const now = Date.now();

    // Check in-memory deduplication cache unless forced
    if (!force && this.dispatchedEventsCache.has(cacheKey)) {
      const lastSent = this.dispatchedEventsCache.get(cacheKey) || 0;
      if (now - lastSent < this.CACHE_TTL_MS) {
        // Event already processed recently for this lead
        return;
      }
    }

    this.dispatchedEventsCache.set(cacheKey, now);

    // Clean up stale cache entries periodically
    if (this.dispatchedEventsCache.size > 2000) {
      for (const [key, timestamp] of this.dispatchedEventsCache.entries()) {
        if (now - timestamp > this.CACHE_TTL_MS) {
          this.dispatchedEventsCache.delete(key);
        }
      }
    }

    // Emit event asynchronously
    this.emit("lead.inquiry", { leadId, schoolId, lead, school });
  }
}

export const admissionsEventManager = AdmissionsEventManager.getInstance();

/**
 * Convenient helper to trigger the initial inquiry email automation.
 */
export function triggerInquiryNotification(params: {
  leadId: string;
  schoolId?: string;
  lead?: any;
  school?: any;
  force?: boolean;
}) {
  admissionsEventManager.triggerInquiryNotification(params);
}
