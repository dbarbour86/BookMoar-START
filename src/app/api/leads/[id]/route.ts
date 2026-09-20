import { NextResponse } from "next/server";
import { getLeadById, transitionLeadStatus, updateLeadStatusSchema } from "@/modules/leads";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * Get Lead Detail
 * GET /api/leads/[id]
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const lead = await getLeadById(params.id);
    if (!lead) {
      return jsonError("Lead not found", 404);
    }

    return NextResponse.json({ lead });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Update Lead Status (Enforcing Lifecycle Transitions)
 * PATCH /api/leads/[id]
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const { status } = updateLeadStatusSchema.parse(body);

    const updatedLead = await transitionLeadStatus(params.id, status);
    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error) {
    return handleApiError(error);
  }
}
