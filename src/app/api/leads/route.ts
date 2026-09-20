import { NextResponse } from "next/server";
import { publicLeadIntakeSchema, createWebsiteLead, listLeads } from "@/modules/leads";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/errors";

/**
 * Public Lead Intake
 * POST /api/leads
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verify honeypot anti-spam
    if (body.website_hp && body.website_hp.length > 0) {
      // Silently reject bots without error code to prevent bot learning
      return NextResponse.json({ success: true });
    }

    const validatedData = publicLeadIntakeSchema.parse(body);
    const lead = await createWebsiteLead(validatedData);

    return NextResponse.json(
      {
        success: true,
        lead: {
          id: lead.id,
          name: lead.name,
          status: lead.status,
          createdAt: lead.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Owner Lead Query
 * GET /api/leads?status=all|new|contacted|closed
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "OWNER") {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const statusParam = (searchParams.get("status") || "all").toLowerCase();

    if (!["all", "new", "contacted", "closed"].includes(statusParam)) {
      return jsonError("Invalid status filter. Allowed: all, new, contacted, closed", 400);
    }

    const leads = await listLeads(statusParam as "all" | "new" | "contacted" | "closed");
    return NextResponse.json({ leads });
  } catch (error) {
    return handleApiError(error);
  }
}
