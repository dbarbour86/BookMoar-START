import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getDashboardSummary, getTimezoneDayRange, getTimezoneWeekRange } from "@/modules/dashboard";
import { createAppointment, transitionAppointmentStatus } from "@/modules/appointments";
import { createWebsiteLead } from "@/modules/leads";
import { AppointmentStatus, LeadStatus } from "@prisma/client";

describe("Dashboard Metrics & Timezone Booked Value Calculations", () => {
  const createdLeadIds: string[] = [];
  const createdApptIds: string[] = [];

  beforeAll(async () => {
    // Clear existing appointments to test exact counts and booked values
    await db.appointment.deleteMany();

    // 1. Create 2 NEW leads
    const lead1 = await createWebsiteLead({
      name: "Lead Metric 1",
      phone: "(919) 555-8111",
    });
    const lead2 = await createWebsiteLead({
      name: "Lead Metric 2",
      phone: "(919) 555-8222",
    });
    createdLeadIds.push(lead1.id, lead2.id);

    // 2. Create appointments scheduled for TODAY in Eastern Time
    const now = new Date();

    // Appointment 1: SCHEDULED ($300 = 30000 cents) -> Included in Booked Value & Today Count
    const apptScheduled = await createAppointment({
      customerName: "Customer Scheduled",
      customerPhone: "(919) 555-8333",
      scheduledAt: now,
      valueCents: 30000,
    });

    // Appointment 2: COMPLETED ($150 = 15000 cents) -> Included in Booked Value, not in Remaining Count
    const apptCompleted = await createAppointment({
      customerName: "Customer Completed",
      customerPhone: "(919) 555-8444",
      scheduledAt: now,
      valueCents: 15000,
    });
    await transitionAppointmentStatus(apptCompleted.id, AppointmentStatus.COMPLETED);

    // Appointment 3: NO_SHOW ($100 = 10000 cents) -> Excluded from Booked Value, shown in Operational List
    const apptNoShow = await createAppointment({
      customerName: "Customer No Show",
      customerPhone: "(919) 555-8555",
      scheduledAt: now,
      valueCents: 10000,
    });
    await transitionAppointmentStatus(apptNoShow.id, AppointmentStatus.NO_SHOW);

    // Appointment 4: CANCELED ($500 = 50000 cents) -> Excluded from Booked Value AND Excluded from Operational List
    const apptCanceled = await createAppointment({
      customerName: "Customer Canceled",
      customerPhone: "(919) 555-8666",
      scheduledAt: now,
      valueCents: 50000,
    });
    await transitionAppointmentStatus(apptCanceled.id, AppointmentStatus.CANCELED);

    createdApptIds.push(apptScheduled.id, apptCompleted.id, apptNoShow.id, apptCanceled.id);
  });

  afterAll(async () => {
    if (createdApptIds.length > 0) {
      await db.appointment.deleteMany({ where: { id: { in: createdApptIds } } });
    }
    if (createdLeadIds.length > 0) {
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
  });

  it("calculates timezone day and week ranges accurately", () => {
    const tz = "America/New_York";
    const { start, end } = getTimezoneDayRange(tz);

    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(end.getTime()).toBeGreaterThan(start.getTime());

    const { start: weekStart, end: weekEnd } = getTimezoneWeekRange(tz);
    expect(weekStart.getTime()).toBeLessThanOrEqual(start.getTime());
    expect(weekEnd.getTime()).toBeGreaterThanOrEqual(end.getTime());
  });

  it("returns accurate counts for new leads and today's scheduled appointments", async () => {
    const summary = await getDashboardSummary();

    // Expect at least the 2 newly created leads to be counted
    expect(summary.newLeadsCount).toBeGreaterThanOrEqual(2);

    // Today's Appointments count counts SCHEDULED appointments for today
    expect(summary.todaysAppointmentsCount).toBe(1);
  });

  it("calculates Booked Value: includes SCHEDULED & COMPLETED, strictly excludes CANCELED & NO_SHOW", async () => {
    const summary = await getDashboardSummary();

    // Scheduled: $300 (30000)
    // Completed: $150 (15000)
    // No-Show: $100 (excluded)
    // Canceled: $500 (excluded)
    // Expected Booked Value Today = 30000 + 15000 = 45000 cents ($450)
    expect(summary.bookedValueTodayCents).toBe(45000);
  });

  it("Today's Appointments operational list includes SCHEDULED, COMPLETED, NO_SHOW, and strictly EXCLUDES CANCELED", async () => {
    const summary = await getDashboardSummary();

    const statusesInList = summary.todaysAppointments.map((a) => a.status);

    // Must contain SCHEDULED
    expect(statusesInList).toContain(AppointmentStatus.SCHEDULED);
    // Must contain COMPLETED
    expect(statusesInList).toContain(AppointmentStatus.COMPLETED);
    // Must contain NO_SHOW
    expect(statusesInList).toContain(AppointmentStatus.NO_SHOW);
    // Must NOT contain CANCELED
    expect(statusesInList).not.toContain(AppointmentStatus.CANCELED);
  });
});
