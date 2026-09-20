import { NextResponse } from "next/server";
import { getBusinessProfile, updateBusinessProfile, updateBusinessSchema } from "@/modules/business";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * GET /api/business
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const business = await getBusinessProfile();
    return NextResponse.json({ business });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/business
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const validatedData = updateBusinessSchema.parse(body);

    const business = await updateBusinessProfile(validatedData);
    return NextResponse.json({ success: true, business });
  } catch (error) {
    return handleApiError(error);
  }
}
