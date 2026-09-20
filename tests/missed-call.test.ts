import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  isCallMissed,
  processDialActionCallback,
} from "@/modules/missed-call";
import {
  setSmsProviderForTesting,
  DevMockSmsProvider,
} from "@/modules/notifications";
import { LeadSource, LeadStatus } from "@prisma/client";

describe("Missed-Call Recovery & Twilio Dial Action Determination", () => {
  let mockProvider: DevMockSmsProvider;
  const testCallSids: string[] = [];

  beforeEach(() => {
    mockProvider = new DevMockSmsProvider();
    setSmsProviderForTesting(mockProvider);
  });

  afterEach(() => {
    setSmsProviderForTesting(null);
  });

  afterAll(async () => {
    if (testCallSids.length > 0) {
      await db.callWebhookEvent.deleteMany({
        where: { callSid: { in: testCallSids } },
      });
    }
    await db.lead.deleteMany({
      where: {
        phone: { in: ["+19195557001", "+19195557002", "+19195557003", "+19195557004", "+19195557005"] },
      },
    });
  });

  describe("Call Missed Determination (isCallMissed)", () => {
    it("answered forwarded call (DialCallStatus: completed) -> NOT missed (no recovery SMS)", () => {
      const missed = isCallMissed({
        DialCallStatus: "completed",
        CallStatus: "completed",
      });
      expect(missed).toBe(false);
    });

    it("unanswered forwarded call (DialCallStatus: no-answer) -> MISSED (recovery SMS)", () => {
      const missed = isCallMissed({
        DialCallStatus: "no-answer",
        CallStatus: "completed",
      });
      expect(missed).toBe(true);
    });

    it("busy forwarded call (DialCallStatus: busy) -> MISSED (recovery SMS)", () => {
      const missed = isCallMissed({
        DialCallStatus: "busy",
        CallStatus: "completed",
      });
      expect(missed).toBe(true);
    });

    it("failed forwarded call (DialCallStatus: failed) -> MISSED (recovery SMS)", () => {
      const missed = isCallMissed({
        DialCallStatus: "failed",
        CallStatus: "completed",
      });
      expect(missed).toBe(true);
    });

    it("canceled forwarded call (DialCallStatus: canceled) -> MISSED (recovery SMS)", () => {
      const missed = isCallMissed({
        DialCallStatus: "canceled",
        CallStatus: "completed",
      });
      expect(missed).toBe(true);
    });
  });

  describe("Webhook Processing Workflow & Idempotency", () => {
    it("1. answered forwarded call: does NOT send recovery SMS and does NOT create missed lead", async () => {
      const callSid = `CA_answered_${Date.now()}`;
      testCallSids.push(callSid);

      const result = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557001",
        DialCallStatus: "completed",
        CallStatus: "completed",
      });

      expect(result.handled).toBe(true);
      expect(result.isMissedCall).toBe(false);
      expect(result.smsSent).toBe(false);
      expect(mockProvider.sentMessages.length).toBe(0);

      // Verify event was recorded as processed without SMS
      const event = await db.callWebhookEvent.findUnique({ where: { callSid } });
      expect(event).toBeDefined();
      expect(event!.processed).toBe(true);
      expect(event!.smsSent).toBe(false);
    });

    it("2. unanswered forwarded call (no-answer): sends recovery SMS and creates MISSED_CALL lead", async () => {
      const callSid = `CA_unanswered_${Date.now()}`;
      testCallSids.push(callSid);

      const result = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557002",
        DialCallStatus: "no-answer",
        CallStatus: "completed",
      });

      expect(result.handled).toBe(true);
      expect(result.isMissedCall).toBe(true);
      expect(result.smsSent).toBe(true);
      expect(mockProvider.sentMessages.length).toBe(1);
      expect(mockProvider.sentMessages[0].to).toBe("+19195557002");

      // Verify lead was created with source MISSED_CALL
      expect(result.leadId).toBeDefined();
      const lead = await db.lead.findUnique({ where: { id: result.leadId } });
      expect(lead).toBeDefined();
      expect(lead!.source).toBe(LeadSource.MISSED_CALL);
      expect(lead!.status).toBe(LeadStatus.NEW);
    });

    it("3. busy forwarded call (busy): sends recovery SMS", async () => {
      const callSid = `CA_busy_${Date.now()}`;
      testCallSids.push(callSid);

      const result = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557003",
        DialCallStatus: "busy",
        CallStatus: "completed",
      });

      expect(result.isMissedCall).toBe(true);
      expect(result.smsSent).toBe(true);
      expect(mockProvider.sentMessages.length).toBe(1);
    });

    it("4. failed forwarded call (failed): sends recovery SMS", async () => {
      const callSid = `CA_failed_${Date.now()}`;
      testCallSids.push(callSid);

      const result = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557004",
        DialCallStatus: "failed",
        CallStatus: "completed",
      });

      expect(result.isMissedCall).toBe(true);
      expect(result.smsSent).toBe(true);
      expect(mockProvider.sentMessages.length).toBe(1);
    });

    it("5. duplicate callback for the same call: does NOT send duplicate SMS", async () => {
      const callSid = `CA_dup_test_${Date.now()}`;
      testCallSids.push(callSid);

      // First webhook callback
      const firstResult = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557005",
        DialCallStatus: "no-answer",
      });
      expect(firstResult.smsSent).toBe(true);
      expect(mockProvider.sentMessages.length).toBe(1);

      // Second (duplicate/retry) webhook callback with same CallSid
      const secondResult = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557005",
        DialCallStatus: "no-answer",
      });

      expect(secondResult.duplicate).toBe(true);
      expect(secondResult.smsSent).toBe(false);
      // Provider message count must remain 1!
      expect(mockProvider.sentMessages.length).toBe(1);
    });

    it("associates missed call with an existing open lead from same phone within 24h", async () => {
      const phone = "+19195557006";
      testCallSids.push(`CA_assoc_${Date.now()}`);

      // Create an open lead first
      const openLead = await db.lead.create({
        data: {
          name: "Existing Customer In Discussion",
          phone,
          normalizedPhone: phone,
          source: LeadSource.MANUAL,
          status: LeadStatus.NEW,
          message: "Discussing roof estimate",
        },
      });

      const result = await processDialActionCallback({
        CallSid: testCallSids[testCallSids.length - 1],
        From: phone,
        DialCallStatus: "no-answer",
      });

      expect(result.isMissedCall).toBe(true);
      expect(result.leadId).toBe(openLead.id);

      // Verify the existing lead was updated, not a duplicate lead created
      const updatedLead = await db.lead.findUnique({ where: { id: openLead.id } });
      expect(updatedLead!.message).toContain("[Missed Call logged:");

      // Clean up
      await db.lead.delete({ where: { id: openLead.id } });
    });
  });
});
