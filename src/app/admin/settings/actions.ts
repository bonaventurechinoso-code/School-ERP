"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updatePlanParameters(formData: FormData): Promise<void> {
  try {
    const planId = formData.get("planId") as string;
    const priceNgn = parseInt(formData.get("priceNgn") as string, 10);
    const commissionPercent = parseFloat(formData.get("commissionPercent") as string);
    const maxStudents = parseInt(formData.get("maxStudents") as string, 10);
    const maxStaff = parseInt(formData.get("maxStaff") as string, 10);
    const isActive = formData.get("isActive") === "true";

    if (!planId) return;

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: {
        priceNgn: isNaN(priceNgn) ? undefined : priceNgn,
        commissionPercent: isNaN(commissionPercent) ? undefined : commissionPercent,
        maxStudents: isNaN(maxStudents) ? undefined : maxStudents,
        maxStaff: isNaN(maxStaff) ? undefined : maxStaff,
        isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: "super_admin_ui",
        action: "update_plan_settings",
        metadata: {
          planId,
          planName: updated.name,
          priceNgn: updated.priceNgn,
          commissionPercent: updated.commissionPercent,
        },
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/billings");
    revalidatePath("/admin/saas");
  } catch (err: any) {
    console.error("[updatePlanParameters error]:", err);
  }
}
