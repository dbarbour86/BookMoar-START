import { NextResponse } from "next/server";
import {
  getAppointmentById,
  updateAppointment,
  updateAppointmentSchema,
  transitionAppointmentStatus,
  updateAppointmentStatusSchema,
} from "@/modules/appointments";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * GET /api/appointments/[id]
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const appointment = await getAppointmentById(params.id);
    if (!appointment) {
      return jsonError("Appointment not found", 404);
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/appointments/[id]
 * Supports updating appointment details or transitioning status
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();

    // If status is provided, perform status transition with lifecycle validation
    if (body.status !== undefined) {
      const { status } = updateAppointmentStatusSchema.parse(body);
      const updated = await transitionAppointmentStatus(params.id, status);
      return NextResponse.json({ success: true, appointment: updated });
    }

    // Otherwise perform general appointment details update
    const validated = updateAppointmentSchema.parse(body);
    const updated = await updateAppointment(params.id, validated);
    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
