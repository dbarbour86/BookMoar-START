import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  createAppointment,
  updateAppointment,
  transitionAppointmentStatus,
  listAppointments,
  isValidAppointmentTransition,
} from "@/modules/appointments";
import { createWebsiteLead } from "@/modules/leads";
import { createService, updateService, setServiceActive } from "@/modules/services";
import { AppointmentStatus, LeadStatus } from "@prisma/client";

describe("Appointments Module & Lead Booking Workflow", () => {
  let serviceId: string;
  let testLeadId: string;
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    // Create test service with default price $200 (20000 cents)
    const service = await createService({
      name: "Paint Correction & Polish",
      description: "Stage 2 paint enhancement",
      defaultPriceCents: 20000,
    });
    serviceId = service.id;

    // Create a NEW website lead
    const lead = await createWebsiteLead({
      name: "Hannah Abbott",
      phone: "(919) 555-4321",
      email: "hannah@example.com",
      serviceId,
      message: "Please book me for paint correction on Saturday.",
    });
    testLeadId = lead.id;
  });

  afterAll(async () => {
    if (createdAppointmentIds.length > 0) {
      await db.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    }
    await db.lead.deleteMany({ where: { id: testLeadId } });
    await db.service.deleteMany({ where: { id: serviceId } });
  });

  it("owner can create Appointment from Lead with service price defaulting and serviceName snapshotting", async () => {
    const scheduledDate = new Date(Date.now() + 86400 * 1000); // Tomorrow

    const appointment = await createAppointment({
      leadId: testLeadId,
      customerName: "Hannah Abbott",
      customerPhone: "(919) 555-4321",
      customerEmail: "hannah@example.com",
      serviceId,
      scheduledAt: scheduledDate,
      durationMinutes: 90,
      notes: "Customer confirmed via text",
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.id).toBeDefined();
    expect(appointment.customerName).toBe("Hannah Abbott");
    expect(appointment.customerPhone).toBe("(919) 555-4321");
    expect(appointment.leadId).toBe(testLeadId);
    expect(appointment.serviceId).toBe(serviceId);
    // Snapshotted service name
    expect(appointment.serviceName).toBe("Paint Correction & Polish");
    // Initialized value from service default price ($200)
    expect(appointment.valueCents).toBe(20000);
    expect(appointment.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it("booking a NEW Lead marks the Lead as at least CONTACTED and preserves Lead record", async () => {
    // Check that the lead was updated to CONTACTED
    const leadAfterBooking = await db.lead.findUnique({
      where: { id: testLeadId },
    });

    expect(leadAfterBooking).toBeDefined();
    expect(leadAfterBooking!.status).toBe(LeadStatus.CONTACTED);
    expect(leadAfterBooking!.contactedAt).toBeInstanceOf(Date);
  });

  it("Appointment value can override Service default without mutating Service default", async () => {
    const appointment = await createAppointment({
      customerName: "Liam Custom Quote",
      customerPhone: "(919) 555-9876",
      serviceId,
      scheduledAt: new Date(),
      valueCents: 27500, // $275 (overriding the $200 default)
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.valueCents).toBe(27500);

    // Verify Service default price remained untouched ($200)
    const service = await db.service.findUnique({ where: { id: serviceId } });
    expect(service!.defaultPriceCents).toBe(20000);
  });

  it("snapshotted serviceName remains preserved even if Service is later renamed or deactivated", async () => {
    // Create temporary service
    const tempService = await createService({
      name: "Original Ceramic Pro",
      defaultPriceCents: 80000,
    });

    const appointment = await createAppointment({
      customerName: "Noah Preservation Test",
      customerPhone: "(919) 555-6677",
      serviceId: tempService.id,
      scheduledAt: new Date(),
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.serviceName).toBe("Original Ceramic Pro");

    // Later: Book Moar renames and deactivates the service
    await updateService(tempService.id, {
      name: "Elite Ceramic Pro Plus (Renamed)",
      defaultPriceCents: 95000,
    });
    await setServiceActive(tempService.id, false);

    // Check appointment: historical display still has the snapshotted name and original price!
    const queried = await db.appointment.findUnique({ where: { id: appointment.id } });
    expect(queried!.serviceName).toBe("Original Ceramic Pro");
    expect(queried!.valueCents).toBe(80000);

    // Clean up temp service
    await db.service.delete({ where: { id: tempService.id } });
  });

  it("manual Appointment can be created without an existing Lead", async () => {
    const manualAppt = await createAppointment({
      customerName: "Walk-in Customer",
      customerPhone: "(919) 555-1122",
      scheduledAt: new Date(Date.now() + 3600 * 1000 * 3),
      durationMinutes: 60,
      valueCents: 15000,
      notes: "Booked directly over the phone",
    });
    createdAppointmentIds.push(manualAppt.id);

    expect(manualAppt.id).toBeDefined();
    expect(manualAppt.leadId).toBeNull();
    expect(manualAppt.customerName).toBe("Walk-in Customer");
  });

  describe("Appointment Status Transitions", () => {
    it("validates allowed and rejected status transitions", () => {
      expect(isValidAppointmentTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED)).toBe(true);
      expect(isValidAppointmentTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELED)).toBe(true);
      expect(isValidAppointmentTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.NO_SHOW)).toBe(true);

      // Disallowed
      expect(isValidAppointmentTransition(AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED)).toBe(false);
      expect(isValidAppointmentTransition(AppointmentStatus.CANCELED, AppointmentStatus.COMPLETED)).toBe(false);
      expect(isValidAppointmentTransition(AppointmentStatus.NO_SHOW, AppointmentStatus.SCHEDULED)).toBe(false);
    });

    it("transitions SCHEDULED -> COMPLETED", async () => {
      const appt = await createAppointment({
        customerName: "Complete Test",
        customerPhone: "(919) 555-2233",
        scheduledAt: new Date(),
      });
      createdAppointmentIds.push(appt.id);

      const completed = await transitionAppointmentStatus(appt.id, AppointmentStatus.COMPLETED);
      expect(completed.status).toBe(AppointmentStatus.COMPLETED);
    });

    it("transitions SCHEDULED -> CANCELED", async () => {
      const appt = await createAppointment({
        customerName: "Cancel Test",
        customerPhone: "(919) 555-3344",
        scheduledAt: new Date(),
      });
      createdAppointmentIds.push(appt.id);

      const canceled = await transitionAppointmentStatus(appt.id, AppointmentStatus.CANCELED);
      expect(canceled.status).toBe(AppointmentStatus.CANCELED);
    });

    it("transitions SCHEDULED -> NO_SHOW", async () => {
      const appt = await createAppointment({
        customerName: "No Show Test",
        customerPhone: "(919) 555-4455",
        scheduledAt: new Date(),
      });
      createdAppointmentIds.push(appt.id);

      const noShow = await transitionAppointmentStatus(appt.id, AppointmentStatus.NO_SHOW);
      expect(noShow.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it("rejects invalid transition from completed/canceled", async () => {
      const appt = await createAppointment({
        customerName: "Invalid Transition Test",
        customerPhone: "(919) 555-5566",
        scheduledAt: new Date(),
      });
      createdAppointmentIds.push(appt.id);

      await transitionAppointmentStatus(appt.id, AppointmentStatus.COMPLETED);

      await expect(
        transitionAppointmentStatus(appt.id, AppointmentStatus.CANCELED)
      ).rejects.toThrow("Invalid status transition");
    });
  });

  describe("Appointment Filtering", () => {
    it("lists appointments correctly with status filters", async () => {
      const upcoming = await listAppointments("upcoming");
      expect(upcoming.every((a) => a.status === AppointmentStatus.SCHEDULED)).toBe(true);

      const completed = await listAppointments("completed");
      expect(completed.every((a) => a.status === AppointmentStatus.COMPLETED)).toBe(true);

      const canceled = await listAppointments("canceled");
      expect(canceled.every((a) => a.status === AppointmentStatus.CANCELED)).toBe(true);

      const noShow = await listAppointments("no_show");
      expect(noShow.every((a) => a.status === AppointmentStatus.NO_SHOW)).toBe(true);
    });
  });
});
