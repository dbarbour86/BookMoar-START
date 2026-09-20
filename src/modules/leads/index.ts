import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { LeadSource, LeadStatus, Lead } from "@prisma/client";
import { z } from "zod";
import { notifyOwnerOfNewLead } from "@/modules/notifications";

export const publicLeadIntakeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(7, "Phone number is required").max(30),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  serviceId: z.string().cuid("Invalid service ID").optional().nullable().or(z.literal("")),
  message: z.string().max(1000, "Message is too long").optional().nullable(),
  // Honeypot field for abuse protection
  website_hp: z.string().max(0, "Bot detected").optional(),
});

export const manualLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(7, "Phone number is required").max(30),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  serviceId: z.string().cuid("Invalid service ID").optional().nullable().or(z.literal("")),
  message: z.string().max(1000, "Message is too long").optional().nullable(),
});

export const updateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus, {
    errorMap: () => ({ message: "Status must be NEW, CONTACTED, or CLOSED" }),
  }),
});

export type PublicLeadIntakeInput = z.infer<typeof publicLeadIntakeSchema>;
export type ManualLeadInput = z.infer<typeof manualLeadSchema>;

/**
 * Validates allowed state machine transitions for Book Moar START V1:
 * - NEW -> CONTACTED
 * - NEW -> CLOSED
 * - CONTACTED -> CLOSED
 * - CLOSED -> CONTACTED (reopening a closed lead)
 * All other transitions are rejected.
 */
export function isValidStatusTransition(currentStatus: LeadStatus, nextStatus: LeadStatus): boolean {
  if (currentStatus === nextStatus) return false;

  if (currentStatus === LeadStatus.NEW) {
    return nextStatus === LeadStatus.CONTACTED || nextStatus === LeadStatus.CLOSED;
  }

  if (currentStatus === LeadStatus.CONTACTED) {
    return nextStatus === LeadStatus.CLOSED;
  }

  if (currentStatus === LeadStatus.CLOSED) {
    return nextStatus === LeadStatus.CONTACTED;
  }

  return false;
}

/**
 * Creates a new lead from the public website intake endpoint.
 * ARCHITECTURAL RULE:
 * Every validated WEBSITE submission creates a fresh Lead record even if the phone number submitted previously.
 * Service ID must be valid and ACTIVE if provided.
 */
export async function createWebsiteLead(input: PublicLeadIntakeInput): Promise<Lead> {
  let activeServiceName: string | null = null;
  const cleanServiceId = input.serviceId ? input.serviceId.trim() : null;

  if (cleanServiceId) {
    const service = await db.service.findUnique({
      where: { id: cleanServiceId },
    });

    if (!service) {
      throw new Error("Requested service does not exist");
    }

    if (!service.active) {
      throw new Error("Requested service is no longer active");
    }

    activeServiceName = service.name;
  }

  const normalizedPhone = normalizePhone(input.phone);

  const lead = await db.lead.create({
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      normalizedPhone,
      email: input.email?.trim() || null,
      message: input.message?.trim() || null,
      serviceId: cleanServiceId,
      source: LeadSource.WEBSITE,
      status: LeadStatus.NEW,
    },
    include: {
      service: true,
    },
  });

  // Trigger owner notification asynchronously; isolated so failure never aborts lead
  void notifyOwnerOfNewLead({
    customerName: lead.name,
    customerPhone: lead.phone,
    serviceName: activeServiceName,
  });

  return lead;
}

/**
 * Creates a lead entered manually by the authenticated business owner.
 */
export async function createManualLead(input: ManualLeadInput): Promise<Lead> {
  const cleanServiceId = input.serviceId ? input.serviceId.trim() : null;

  if (cleanServiceId) {
    const service = await db.service.findUnique({
      where: { id: cleanServiceId },
    });
    if (!service) {
      throw new Error("Requested service does not exist");
    }
  }

  const normalizedPhone = normalizePhone(input.phone);

  return db.lead.create({
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      normalizedPhone,
      email: input.email?.trim() || null,
      message: input.message?.trim() || null,
      serviceId: cleanServiceId,
      source: LeadSource.MANUAL,
      status: LeadStatus.NEW,
    },
    include: {
      service: true,
    },
  });
}

/**
 * Updates a lead's status strictly enforcing the lifecycle state machine.
 */
export async function transitionLeadStatus(leadId: string, nextStatus: LeadStatus): Promise<Lead> {
  const currentLead = await db.lead.findUnique({
    where: { id: leadId },
  });

  if (!currentLead) {
    throw new Error("Lead not found");
  }

  if (!isValidStatusTransition(currentLead.status, nextStatus)) {
    throw new Error(
      `Invalid status transition from ${currentLead.status} to ${nextStatus}. Allowed: NEW->CONTACTED, NEW->CLOSED, CONTACTED->CLOSED, CLOSED->CONTACTED.`
    );
  }

  const dataToUpdate: {
    status: LeadStatus;
    contactedAt?: Date | null;
    closedAt?: Date | null;
  } = {
    status: nextStatus,
  };

  const now = new Date();

  if (nextStatus === LeadStatus.CONTACTED) {
    dataToUpdate.contactedAt = now;
    if (currentLead.status === LeadStatus.CLOSED) {
      // Reopened lead
      dataToUpdate.closedAt = null;
    }
  } else if (nextStatus === LeadStatus.CLOSED) {
    dataToUpdate.closedAt = now;
  }

  return db.lead.update({
    where: { id: leadId },
    data: dataToUpdate,
    include: {
      service: true,
    },
  });
}

/**
 * Lists leads for the owner inbox with optional status filter.
 * Default ordering: newest actionable leads first.
 */
export async function listLeads(filterStatus?: "all" | "new" | "contacted" | "closed") {
  let whereClause = {};

  if (filterStatus && filterStatus !== "all") {
    const mappedStatus = filterStatus.toUpperCase() as LeadStatus;
    whereClause = { status: mappedStatus };
  }

  return db.lead.findMany({
    where: whereClause,
    include: {
      service: {
        select: {
          id: true,
          name: true,
          defaultPriceCents: true,
        },
      },
    },
    orderBy: [
      // NEW leads first, then by createdAt desc
      { createdAt: "desc" },
    ],
  });
}

export async function getLeadById(id: string) {
  return db.lead.findUnique({
    where: { id },
    include: {
      service: true,
    },
  });
}
