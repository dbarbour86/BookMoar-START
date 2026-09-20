import { NextResponse } from "next/server";
import { createServiceSchema, createService, listActiveServices, listAllServices } from "@/modules/services";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * GET /api/services
 * Public caller -> active services only
 * Authenticated owner -> all services (active + inactive)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const isOwner = user && user.role === "OWNER";

    const services = isOwner ? await listAllServices() : await listActiveServices();
    return NextResponse.json({ services });
  } catch (error) {
    return handleApiError(error);
  }
}

import { isInternalSetupEnabled } from "@/lib/setup";

/**
 * POST /api/services
 * Authenticated owner creates new service (requires internal setup mode)
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    if (!isInternalSetupEnabled()) {
      return jsonError("Internal setup mode is disabled", 403);
    }

    const body = await req.json();
    const validatedData = createServiceSchema.parse(body);
    const service = await createService(validatedData);

    return NextResponse.json({ success: true, service }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
