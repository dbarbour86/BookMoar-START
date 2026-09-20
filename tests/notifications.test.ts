import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  setSmsProviderForTesting,
  DevMockSmsProvider,
  SmsProvider,
  SmsSendResult,
} from "@/modules/notifications";
import { createWebsiteLead } from "@/modules/leads";

class FailingSmsProvider implements SmsProvider {
  async sendSms(): Promise<SmsSendResult> {
    throw new Error("Simulated Twilio API Network Outage");
  }
}

describe("Owner Notification Subsystem", () => {
  let mockProvider: DevMockSmsProvider;
  const createdLeadIds: string[] = [];

  beforeEach(() => {
    mockProvider = new DevMockSmsProvider();
    setSmsProviderForTesting(mockProvider);
  });

  afterEach(() => {
    setSmsProviderForTesting(null);
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
  });

  it("sends expected notification payload on successful lead creation", async () => {
    const lead = await createWebsiteLead({
      name: "Gregory House",
      phone: "(919) 555-0811",
      message: "Emergency diagnostic required.",
    });
    createdLeadIds.push(lead.id);

    // Allow async notification promise tick to run
    await new Promise((r) => setTimeout(r, 50));

    expect(mockProvider.sentMessages.length).toBe(1);
    const sent = mockProvider.sentMessages[0];
    expect(sent.body).toContain("New Book Moar lead: Gregory House");
    expect(sent.body).toContain("(919) 555-0811");
  });

  it("CRITICAL RULE: Lead creation persists even when notification provider throws an error", async () => {
    // Inject failing provider
    setSmsProviderForTesting(new FailingSmsProvider());

    // Creating lead should NOT throw or abort
    const lead = await createWebsiteLead({
      name: "Resilient Lead",
      phone: "(919) 555-0822",
      message: "I must be saved even if SMS fails!",
    });
    createdLeadIds.push(lead.id);

    // Verify lead was stored successfully in database
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb).toBeDefined();
    expect(inDb!.name).toBe("Resilient Lead");
    expect(inDb!.phone).toBe("(919) 555-0822");
    expect(inDb!.status).toBe("NEW");
  });
});
