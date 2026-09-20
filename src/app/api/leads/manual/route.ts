import { NextResponse } from "next/server";
import { manualLeadSchema, createManualLead } from "@/modules/leads";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * Owner Manual Lead Entry
 * POST /api/leads/manual
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const validatedData = manualLeadSchema.parse(body);
    const lead = await createManualLead(validatedData);

    return NextResponse.json({ success: true, lead }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
