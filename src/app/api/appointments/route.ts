import { NextResponse } from "next/server";
import { createAppointmentSchema, createAppointment, listAppointments } from "@/modules/appointments";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * GET /api/appointments?filter=upcoming|completed|canceled|no_show|all
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get("filter") || "upcoming").toLowerCase();

    if (!["upcoming", "completed", "canceled", "no_show", "all"].includes(filter)) {
      return jsonError("Invalid filter parameter", 400);
    }

    const appointments = await listAppointments(filter as "upcoming" | "completed" | "canceled" | "no_show" | "all");
    return NextResponse.json({ appointments });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/appointments
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const validated = createAppointmentSchema.parse(body);
    const appointment = await createAppointment(validated);

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
