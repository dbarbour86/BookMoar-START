import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  createService,
  updateService,
  setServiceActive,
  listActiveServices,
  listAllServices,
} from "@/modules/services";
import { createWebsiteLead } from "@/modules/leads";

describe("Services Management", () => {
  const createdServiceIds: string[] = [];
  const createdLeadIds: string[] = [];

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    if (createdServiceIds.length > 0) {
      await db.service.deleteMany({ where: { id: { in: createdServiceIds } } });
    }
  });

  it("creates a new service with integer cents for price", async () => {
    const service = await createService({
      name: "Roof Leak Diagnostic",
      description: "Complete drone and attic inspection to locate leaks.",
      defaultPriceCents: 19900, // $199.00
    });

    createdServiceIds.push(service.id);

    expect(service.id).toBeDefined();
    expect(service.name).toBe("Roof Leak Diagnostic");
    expect(service.defaultPriceCents).toBe(19900);
    expect(service.active).toBe(true);
  });

  it("edits an existing service", async () => {
    const service = await createService({
      name: "Original Service Name",
      defaultPriceCents: 5000,
    });
    createdServiceIds.push(service.id);

    const updated = await updateService(service.id, {
      name: "Updated Service Name",
      defaultPriceCents: 7500,
    });

    expect(updated.name).toBe("Updated Service Name");
    expect(updated.defaultPriceCents).toBe(7500);
  });

  it("deactivates and reactivates a service", async () => {
    const service = await createService({
      name: "Seasonal Gutter Cleaning",
      defaultPriceCents: 12000,
    });
    createdServiceIds.push(service.id);

    // Deactivate
    const deactivated = await setServiceActive(service.id, false);
    expect(deactivated.active).toBe(false);

    // Should NOT appear in active services list
    const activeList = await listActiveServices();
    expect(activeList.some((s) => s.id === service.id)).toBe(false);

    // SHOULD appear in all services list
    const allList = await listAllServices();
    expect(allList.some((s) => s.id === service.id)).toBe(true);

    // Reactivate
    const reactivated = await setServiceActive(service.id, true);
    expect(reactivated.active).toBe(true);

    const activeListAfter = await listActiveServices();
    expect(activeListAfter.some((s) => s.id === service.id)).toBe(true);
  });

  it("historical leads retain inactive service relationship", async () => {
    const service = await createService({
      name: "Discontinued Coating",
      defaultPriceCents: 50000,
    });
    createdServiceIds.push(service.id);

    // Create lead with this service while active
    const lead = await createWebsiteLead({
      name: "Historical Lead",
      phone: "(919) 555-4422",
      serviceId: service.id,
    });
    createdLeadIds.push(lead.id);

    expect(lead.serviceId).toBe(service.id);

    // Deactivate service
    await setServiceActive(service.id, false);

    // Re-query lead: relationship must still be present and intact!
    const queriedLead = await db.lead.findUnique({
      where: { id: lead.id },
      include: { service: true },
    });

    expect(queriedLead).toBeDefined();
    expect(queriedLead!.serviceId).toBe(service.id);
    expect(queriedLead!.service).toBeDefined();
    expect(queriedLead!.service!.name).toBe("Discontinued Coating");
    expect(queriedLead!.service!.active).toBe(false);
  });
});
