import { db } from "@/lib/db";
import { getBusinessProfile } from "@/modules/business";
import { AppointmentStatus, LeadStatus } from "@prisma/client";

/**
 * Returns the UTC Date boundaries for "Today" in the specified IANA timezone.
 */
export function getTimezoneDayRange(timeZone: string, refDate = new Date()): { start: Date; end: Date } {
  // Get date representation in the target timezone (YYYY-MM-DD)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(refDate); // e.g. "2026-09-20"
  const [year, month, day] = dateStr.split("-").map(Number);

  // Determine the timezone offset for the start of this day
  // Create a UTC date near midday and inspect its target timezone offset
  const middayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(middayUtc);

  const offsetString = offsetParts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  // offsetString is e.g. "GMT-04:00" or "GMT+01:00" or "GMT"
  let offsetHours = 0;
  let offsetMinutes = 0;
  const match = offsetString.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    offsetHours = sign * parseInt(match[2], 10);
    offsetMinutes = sign * parseInt(match[3] || "0", 10);
  }

  // Midnight in local timeZone in UTC is: localMidnight - offset
  const localMidnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - (offsetHours * 60 + offsetMinutes) * 60 * 1000;
  const start = new Date(localMidnightUtcMs);
  const end = new Date(localMidnightUtcMs + 24 * 60 * 60 * 1000 - 1);

  return { start, end };
}

/**
 * Returns the UTC Date boundaries for "This Week" (Sunday to Saturday) in the specified IANA timezone.
 */
export function getTimezoneWeekRange(timeZone: string, refDate = new Date()): { start: Date; end: Date } {
  const { start: todayStart } = getTimezoneDayRange(timeZone, refDate);

  // Find day of week in target timezone (0 = Sunday, 6 = Saturday)
  const dayOfWeekFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const weekday = dayOfWeekFormatter.format(refDate);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayIndex = weekdayMap[weekday] ?? 0;

  const startMs = todayStart.getTime() - dayIndex * 24 * 60 * 60 * 1000;
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000 - 1;

  return {
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

export interface DashboardSummary {
  newLeadsCount: number;
  todaysAppointmentsCount: number;
  bookedValueTodayCents: number;
  bookedValueWeekCents: number;
  todaysAppointments: Array<{
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    serviceName?: string | null;
    scheduledAt: Date;
    durationMinutes: number;
    valueCents?: number | null;
    status: AppointmentStatus;
    notes?: string | null;
    leadId?: string | null;
  }>;
  recentNewLeads: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    service?: { name: string; defaultPriceCents?: number | null } | null;
    source: string;
    createdAt: Date;
    message?: string | null;
  }>;
  businessTimezone: string;
}

/**
 * Computes dashboard metrics and operational lists for today.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const business = await getBusinessProfile();
  const timezone = business.timezone || "America/New_York";

  const { start: todayStart, end: todayEnd } = getTimezoneDayRange(timezone);
  const { start: weekStart, end: weekEnd } = getTimezoneWeekRange(timezone);

  // 1. Count of NEW leads
  const newLeadsCount = await db.lead.count({
    where: { status: LeadStatus.NEW },
  });

  // 2. Count of SCHEDULED appointments for today (upcoming/remaining)
  const todaysAppointmentsCount = await db.appointment.count({
    where: {
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: AppointmentStatus.SCHEDULED,
    },
  });

  // 3. Booked Value — Today:
  // Derived from Appointment.valueCents.
  // Includes SCHEDULED and COMPLETED. Strictly excludes CANCELED and NO_SHOW.
  const todayValuedAppointments = await db.appointment.findMany({
    where: {
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
      },
    },
    select: { valueCents: true },
  });

  const bookedValueTodayCents = todayValuedAppointments.reduce(
    (sum, appt) => sum + (appt.valueCents || 0),
    0
  );

  // 4. Booked Value — Week:
  // Includes SCHEDULED and COMPLETED for this week.
  const weekValuedAppointments = await db.appointment.findMany({
    where: {
      scheduledAt: {
        gte: weekStart,
        lte: weekEnd,
      },
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
      },
    },
    select: { valueCents: true },
  });

  const bookedValueWeekCents = weekValuedAppointments.reduce(
    (sum, appt) => sum + (appt.valueCents || 0),
    0
  );

  // 5. Today's Appointments operational list:
  // Includes SCHEDULED, COMPLETED, NO_SHOW. Strictly excludes CANCELED.
  const todaysAppointments = await db.appointment.findMany({
    where: {
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: {
        in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW],
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });

  // 6. Recent NEW leads (up to 5)
  const recentNewLeads = await db.lead.findMany({
    where: { status: LeadStatus.NEW },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      service: {
        select: {
          name: true,
          defaultPriceCents: true,
        },
      },
    },
  });

  return {
    newLeadsCount,
    todaysAppointmentsCount,
    bookedValueTodayCents,
    bookedValueWeekCents,
    todaysAppointments,
    recentNewLeads,
    businessTimezone: timezone,
  };
}
