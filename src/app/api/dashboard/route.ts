import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/modules/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard
 * Authenticated owner operational dashboard data
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const summary = await getDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
