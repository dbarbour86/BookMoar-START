import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  createWebsiteLead,
  createManualLead,
  transitionLeadStatus,
  listLeads,
  isValidStatusTransition,
} from "@/modules/leads";
import { LeadSource, LeadStatus } from "@prisma/client";

describe("Lead Management & Lifecycle Transitions", () => {
  let activeServiceId: string;
  let inactiveServiceId: string;

  beforeAll(async () => {
    // Create test active service
    const activeService = await db.service.create({
      data: {
        name: "Test Active Service",
        description: "Active service for testing",
        defaultPriceCents: 10000,
        active: true,
      },
    });
    activeServiceId = activeService.id;

    // Create test inactive service
    const inactiveService = await db.service.create({
      data: {
        name: "Test Inactive Service",
        description: "Inactive service",
        defaultPriceCents: 20000,
        active: false,
      },
    });
    inactiveServiceId = inactiveService.id;
  });

  afterAll(async () => {
    await db.lead.deleteMany({
      where: {
        phone: {
          in: ["(919) 555-0191", "(919) 555-0192", "(919) 555-0193", "(919) 555-0194"],
        },
      },
    });
    await db.service.deleteMany({
      where: { id: { in: [activeServiceId, inactiveServiceId] } },
    });
  });

  it("valid public lead intake creates NEW lead with source WEBSITE", async () => {
    const lead = await createWebsiteLead({
      name: "Alice Walker",
      phone: "(919) 555-0191",
      email: "alice@example.com",
      serviceId: activeServiceId,
      message: "Need this service next Monday.",
    });

    expect(lead.id).toBeDefined();
    expect(lead.name).toBe("Alice Walker");
    expect(lead.status).toBe(LeadStatus.NEW);
    expect(lead.source).toBe(LeadSource.WEBSITE);
    expect(lead.serviceId).toBe(activeServiceId);
    expect(lead.normalizedPhone).toBe("+19195550191");
  });

  it("rejects public lead intake referencing an inactive service", async () => {
    await expect(
      createWebsiteLead({
        name: "Bob Inactive",
        phone: "(919) 555-0192",
        serviceId: inactiveServiceId,
      })
    ).rejects.toThrow("Requested service is no longer active");
  });

  it("rejects public lead intake referencing a non-existent service", async () => {
    await expect(
      createWebsiteLead({
        name: "Charlie Nonexistent",
        phone: "(919) 555-0193",
        serviceId: "cuidfake000000000000000000",
      })
    ).rejects.toThrow("Requested service does not exist");
  });

  it("creates separate leads for repeated website submissions from the same phone number (no silent overwrite)", async () => {
    const phone = "(919) 555-0194";

    const lead1 = await createWebsiteLead({
      name: "Diana First Inquiry",
      phone,
      message: "First inquiry",
    });

    const lead2 = await createWebsiteLead({
      name: "Diana Second Inquiry",
      phone,
      message: "Second inquiry 10 minutes later",
    });

    expect(lead1.id).not.toBe(lead2.id);
    expect(lead1.phone).toBe(phone);
    expect(lead2.phone).toBe(phone);
    expect(lead1.status).toBe(LeadStatus.NEW);
    expect(lead2.status).toBe(LeadStatus.NEW);

    const check1 = await db.lead.findUnique({ where: { id: lead1.id } });
    const check2 = await db.lead.findUnique({ where: { id: lead2.id } });
    expect(check1).toBeDefined();
    expect(check2).toBeDefined();
    expect(check1!.name).toBe("Diana First Inquiry");
    expect(check2!.name).toBe("Diana Second Inquiry");
  });

  it("allows owner to create a manual lead with source MANUAL", async () => {
    const manualLead = await createManualLead({
      name: "Frank Walk-in",
      phone: "(919) 555-0195",
      email: "frank@example.com",
      message: "Came into the shop in person",
    });

    expect(manualLead.source).toBe(LeadSource.MANUAL);
    expect(manualLead.status).toBe(LeadStatus.NEW);
    expect(manualLead.name).toBe("Frank Walk-in");

    // Clean up
    await db.lead.delete({ where: { id: manualLead.id } });
  });

  describe("Lifecycle State Machine", () => {
    it("validates allowed and disallowed state machine transitions", () => {
      // Allowed
      expect(isValidStatusTransition(LeadStatus.NEW, LeadStatus.CONTACTED)).toBe(true);
      expect(isValidStatusTransition(LeadStatus.NEW, LeadStatus.CLOSED)).toBe(true);
      expect(isValidStatusTransition(LeadStatus.CONTACTED, LeadStatus.CLOSED)).toBe(true);
      expect(isValidStatusTransition(LeadStatus.CLOSED, LeadStatus.CONTACTED)).toBe(true);

      // Disallowed
      expect(isValidStatusTransition(LeadStatus.NEW, LeadStatus.NEW)).toBe(false);
      expect(isValidStatusTransition(LeadStatus.CONTACTED, LeadStatus.NEW)).toBe(false);
      expect(isValidStatusTransition(LeadStatus.CLOSED, LeadStatus.NEW)).toBe(false);
      expect(isValidStatusTransition(LeadStatus.CONTACTED, LeadStatus.CONTACTED)).toBe(false);
      expect(isValidStatusTransition(LeadStatus.CLOSED, LeadStatus.CLOSED)).toBe(false);
    });

    it("transitions NEW -> CONTACTED and records contactedAt", async () => {
      const testLead = await createManualLead({
        name: "Test Transitions",
        phone: "(919) 555-0999",
      });

      expect(testLead.status).toBe(LeadStatus.NEW);
      expect(testLead.contactedAt).toBeNull();

      const contacted = await transitionLeadStatus(testLead.id, LeadStatus.CONTACTED);
      expect(contacted.status).toBe(LeadStatus.CONTACTED);
      expect(contacted.contactedAt).toBeInstanceOf(Date);
      expect(contacted.closedAt).toBeNull();

      // Transition CONTACTED -> CLOSED and record closedAt
      const closed = await transitionLeadStatus(testLead.id, LeadStatus.CLOSED);
      expect(closed.status).toBe(LeadStatus.CLOSED);
      expect(closed.closedAt).toBeInstanceOf(Date);

      // Reopen CLOSED -> CONTACTED (clears closedAt, refreshes contactedAt)
      const reopened = await transitionLeadStatus(testLead.id, LeadStatus.CONTACTED);
      expect(reopened.status).toBe(LeadStatus.CONTACTED);
      expect(reopened.closedAt).toBeNull();
      expect(reopened.contactedAt).toBeInstanceOf(Date);

      // Attempting invalid transition CLOSED/CONTACTED -> NEW must throw
      await expect(
        transitionLeadStatus(testLead.id, LeadStatus.NEW)
      ).rejects.toThrow("Invalid status transition");

      // Clean up
      await db.lead.delete({ where: { id: testLead.id } });
    });
  });

  describe("Lead Inbox Querying & Filtering", () => {
    it("retrieves leads filtered by status", async () => {
      const allLeads = await listLeads("all");
      expect(Array.isArray(allLeads)).toBe(true);

      const newLeads = await listLeads("new");
      expect(newLeads.every((l) => l.status === LeadStatus.NEW)).toBe(true);

      const contactedLeads = await listLeads("contacted");
      expect(contactedLeads.every((l) => l.status === LeadStatus.CONTACTED)).toBe(true);

      const closedLeads = await listLeads("closed");
      expect(closedLeads.every((l) => l.status === LeadStatus.CLOSED)).toBe(true);
    });
  });
});
