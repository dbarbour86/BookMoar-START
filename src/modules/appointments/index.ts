import { db } from "@/lib/db";
import { AppointmentStatus, LeadStatus } from "@prisma/client";
import { z } from "zod";

export const createAppointmentSchema = z.object({
  leadId: z.string().cuid().optional().nullable(),
  customerName: z.string().min(1, "Customer name is required").max(100),
  customerPhone: z.string().min(7, "Customer phone is required").max(30),
  customerEmail: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  serviceId: z.string().cuid().optional().nullable().or(z.literal("")),
  scheduledAt: z.string().or(z.date()).transform((val) => new Date(val)),
  durationMinutes: z.number().int().positive().default(60),
  valueCents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateAppointmentSchema = z.object({
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().min(7).max(30).optional(),
  customerEmail: z.string().email().optional().nullable().or(z.literal("")),
  serviceId: z.string().cuid().optional().nullable().or(z.literal("")),
  scheduledAt: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  durationMinutes: z.number().int().positive().optional(),
  valueCents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus, {
    errorMap: () => ({ message: "Status must be SCHEDULED, COMPLETED, CANCELED, or NO_SHOW" }),
  }),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/**
 * Validates allowed state transitions for Appointment:
 * SCHEDULED -> COMPLETED
 * SCHEDULED -> CANCELED
 * SCHEDULED -> NO_SHOW
 */
export function isValidAppointmentTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
  if (current === next) return false;
  if (current === AppointmentStatus.SCHEDULED) {
    return (
      next === AppointmentStatus.COMPLETED ||
      next === AppointmentStatus.CANCELED ||
      next === AppointmentStatus.NO_SHOW
    );
  }
  return false;
}

/**
 * Creates an Appointment.
 * REQUIREMENTS:
 * 1. If a Service is selected, snapshots Service.name into Appointment.serviceName.
 * 2. If valueCents is not explicitly specified, defaults from Service.defaultPriceCents.
 * 3. An overridden valueCents must NOT alter Service.defaultPriceCents.
 * 4. If leadId is provided: ensures the Lead is at least CONTACTED (if NEW -> CONTACTED with contactedAt).
 *    Preserves the Lead record and relationship.
 */
export async function createAppointment(input: CreateAppointmentInput) {
  let snapshottedServiceName: string | null = null;
  let resolvedValueCents: number | null = input.valueCents ?? null;

  const cleanServiceId = input.serviceId ? input.serviceId.trim() : null;

  if (cleanServiceId) {
    const service = await db.service.findUnique({
      where: { id: cleanServiceId },
    });
    if (service) {
      snapshottedServiceName = service.name;
      if (resolvedValueCents === null && service.defaultPriceCents !== null) {
        resolvedValueCents = service.defaultPriceCents;
      }
    }
  }

  // Create Appointment
  const appointment = await db.appointment.create({
    data: {
      leadId: input.leadId || null,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      customerEmail: input.customerEmail?.trim() || null,
      serviceId: cleanServiceId,
      serviceName: snapshottedServiceName,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes || 60,
      valueCents: resolvedValueCents,
      status: AppointmentStatus.SCHEDULED,
      notes: input.notes?.trim() || null,
    },
    include: {
      service: true,
      lead: true,
    },
  });

  // If booked from a Lead, ensure the Lead is at least CONTACTED
  if (input.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
    });

    if (lead && lead.status === LeadStatus.NEW) {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.CONTACTED,
          contactedAt: lead.contactedAt || new Date(),
        },
      });
    }
  }

  return appointment;
}

/**
 * Updates appointment details.
 */
export async function updateAppointment(id: string, input: UpdateAppointmentInput) {
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Appointment not found");
  }

  let snapshottedServiceName = existing.serviceName;
  const cleanServiceId = input.serviceId !== undefined ? (input.serviceId ? input.serviceId.trim() : null) : existing.serviceId;

  if (input.serviceId !== undefined && cleanServiceId !== existing.serviceId) {
    if (cleanServiceId) {
      const service = await db.service.findUnique({ where: { id: cleanServiceId } });
      snapshottedServiceName = service ? service.name : null;
    } else {
      snapshottedServiceName = null;
    }
  }

  return db.appointment.update({
    where: { id },
    data: {
      ...(input.customerName !== undefined && { customerName: input.customerName.trim() }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone.trim() }),
      ...(input.customerEmail !== undefined && { customerEmail: input.customerEmail?.trim() || null }),
      serviceId: cleanServiceId,
      serviceName: snapshottedServiceName,
      ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      ...(input.valueCents !== undefined && { valueCents: input.valueCents }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
    },
    include: {
      service: true,
      lead: true,
    },
  });
}

/**
 * Transitions appointment status with validation.
 */
export async function transitionAppointmentStatus(id: string, nextStatus: AppointmentStatus) {
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Appointment not found");
  }

  if (!isValidAppointmentTransition(existing.status, nextStatus)) {
    throw new Error(`Invalid status transition from ${existing.status} to ${nextStatus}. Allowed: SCHEDULED->COMPLETED, SCHEDULED->CANCELED, SCHEDULED->NO_SHOW.`);
  }

  return db.appointment.update({
    where: { id },
    data: { status: nextStatus },
    include: {
      service: true,
      lead: true,
    },
  });
}

/**
 * Lists appointments with filters:
 * - 'upcoming': SCHEDULED appointments ordered by scheduledAt asc
 * - 'completed': COMPLETED appointments ordered by scheduledAt desc
 * - 'canceled': CANCELED appointments ordered by scheduledAt desc
 * - 'no_show': NO_SHOW appointments ordered by scheduledAt desc
 * - 'all': all appointments ordered by scheduledAt desc
 */
export async function listAppointments(filter: "upcoming" | "completed" | "canceled" | "no_show" | "all" = "upcoming") {
  let whereClause = {};
  let orderByClause: { scheduledAt: "asc" | "desc" } = { scheduledAt: "asc" };

  if (filter === "upcoming") {
    whereClause = { status: AppointmentStatus.SCHEDULED };
    orderByClause = { scheduledAt: "asc" };
  } else if (filter === "completed") {
    whereClause = { status: AppointmentStatus.COMPLETED };
    orderByClause = { scheduledAt: "desc" };
  } else if (filter === "canceled") {
    whereClause = { status: AppointmentStatus.CANCELED };
    orderByClause = { scheduledAt: "desc" };
  } else if (filter === "no_show") {
    whereClause = { status: AppointmentStatus.NO_SHOW };
    orderByClause = { scheduledAt: "desc" };
  } else {
    // 'all'
    orderByClause = { scheduledAt: "desc" };
  }

  return db.appointment.findMany({
    where: whereClause,
    include: {
      service: true,
      lead: true,
    },
    orderBy: orderByClause,
  });
}

export async function getAppointmentById(id: string) {
  return db.appointment.findUnique({
    where: { id },
    include: {
      service: true,
      lead: true,
    },
  });
}
