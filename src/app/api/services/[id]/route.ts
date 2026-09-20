import { NextResponse } from "next/server";
import { updateServiceSchema, updateService } from "@/modules/services";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";
import { isInternalSetupEnabled } from "@/lib/setup";

/**
 * PATCH /api/services/[id]
 * Authenticated owner edits or activates/deactivates service (requires internal setup mode)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    if (!isInternalSetupEnabled()) {
      return jsonError("Internal setup mode is disabled", 403);
    }

    const body = await req.json();
    const validatedData = updateServiceSchema.parse(body);

    const updatedService = await updateService(params.id, validatedData);
    return NextResponse.json({ success: true, service: updatedService });
  } catch (error) {
    return handleApiError(error);
  }
}
