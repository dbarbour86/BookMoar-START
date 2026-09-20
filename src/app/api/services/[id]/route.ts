import { NextResponse } from "next/server";
import { updateServiceSchema, updateService } from "@/modules/services";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * PATCH /api/services/[id]
 * Authenticated owner edits or activates/deactivates service
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const validatedData = updateServiceSchema.parse(body);

    const updatedService = await updateService(params.id, validatedData);
    return NextResponse.json({ success: true, service: updatedService });
  } catch (error) {
    return handleApiError(error);
  }
}
