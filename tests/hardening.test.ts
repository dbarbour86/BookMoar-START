import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSecretKey } from "@/lib/auth";
import { initClient } from "../scripts/init-client";
import { isInternalSetupEnabled } from "@/lib/setup";
import { validateTwilioSignature, isTwilioWebhookAuthentic } from "@/lib/twilio";
import { handleApiError } from "@/lib/errors";
import { isCallMissed, processDialActionCallback } from "@/modules/missed-call";
import { setSmsProviderForTesting, DevMockSmsProvider } from "@/modules/notifications";
import { db } from "@/lib/db";
import { ZodError } from "zod";

describe("Production Hardening Pass Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("1. AUTH_SECRET Production Fail-Closed", () => {
    it("fails closed in production if AUTH_SECRET is missing", () => {
      delete process.env.AUTH_SECRET;
      process.env.NODE_ENV = "production";

      expect(() => getSecretKey()).toThrowError(/FATAL: AUTH_SECRET/);
    });

    it("uses configured AUTH_SECRET in production when provided", () => {
      process.env.AUTH_SECRET = "production-super-secret-key-32-chars-long";
      process.env.NODE_ENV = "production";

      const key = getSecretKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBeGreaterThan(0);
    });

    it("allows dev fallback only in non-production", () => {
      delete process.env.AUTH_SECRET;
      process.env.NODE_ENV = "development";

      const key = getSecretKey();
      expect(key).toBeInstanceOf(Uint8Array);
    });
  });

  describe("2. Safe Client Provisioning (initClient)", () => {
    it("validates required inputs cleanly", async () => {
      const res1 = await initClient({
        businessName: "",
        ownerEmail: "test@example.com",
        ownerPassword: "password123",
        businessPhone: "9195550100",
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toMatch(/businessName is required/);

      const res2 = await initClient({
        businessName: "Test Auto",
        ownerEmail: "not-an-email",
        ownerPassword: "password123",
        businessPhone: "9195550100",
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toMatch(/valid ownerEmail/);

      const res3 = await initClient({
        businessName: "Test Auto",
        ownerEmail: "owner@example.com",
        ownerPassword: "short",
        businessPhone: "9195550100",
      });
      expect(res3.success).toBe(false);
      expect(res3.error).toMatch(/at least 8 characters/);
    });

    it("refuses to initialize if an OWNER user already exists", async () => {
      // Find existing owner in database
      const existingOwner = await db.user.findFirst({ where: { role: "OWNER" } });
      if (existingOwner) {
        const res = await initClient({
          businessName: "Second Business Attempt",
          ownerEmail: "newowner@example.com",
          ownerPassword: "ValidPassword123!",
          businessPhone: "+19195550199",
        });
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Deployment already initialized/);
      }
    });
  });

  describe("3. Internal Setup Mode", () => {
    it("returns false when ENABLE_INTERNAL_SETUP is not true", () => {
      process.env.ENABLE_INTERNAL_SETUP = "false";
      expect(isInternalSetupEnabled()).toBe(false);

      delete process.env.ENABLE_INTERNAL_SETUP;
      expect(isInternalSetupEnabled()).toBe(false);
    });

    it("returns true when ENABLE_INTERNAL_SETUP is true", () => {
      process.env.ENABLE_INTERNAL_SETUP = "true";
      expect(isInternalSetupEnabled()).toBe(true);
    });
  });

  describe("4. Twilio Webhook Request Signature Validation", () => {
    const testAuthToken = "test_auth_token_1234567890abcdef";
    const testUrl = "https://app.example.com/api/webhooks/twilio/dial-action";
    const testParams = {
      CallSid: "CA123456789",
      From: "+19195550100",
      DialCallStatus: "no-answer",
    };

    it("validates official Twilio HMAC-SHA1 signature correctly", () => {
      // Compute expected signature for test data
      const crypto = require("crypto");
      const sortedKeys = Object.keys(testParams).sort();
      let data = testUrl;
      for (const k of sortedKeys) {
        data += k + testParams[k as keyof typeof testParams];
      }
      const validSig = crypto.createHmac("sha1", testAuthToken).update(Buffer.from(data, "utf-8")).digest("base64");

      // Test valid signature
      expect(validateTwilioSignature(testUrl, testParams, validSig, testAuthToken)).toBe(true);

      // Test tampered signature
      expect(validateTwilioSignature(testUrl, testParams, "tampered_sig", testAuthToken)).toBe(false);

      // Test tampered parameter
      const tamperedParams = { ...testParams, DialCallStatus: "completed" };
      expect(validateTwilioSignature(testUrl, tamperedParams, validSig, testAuthToken)).toBe(false);
    });

    it("fails closed in production when signature or authToken is missing", () => {
      process.env.NODE_ENV = "production";
      process.env.TWILIO_AUTH_TOKEN = testAuthToken;

      // Missing signature
      expect(isTwilioWebhookAuthentic(testUrl, testParams, null)).toBe(false);

      // Missing auth token
      delete process.env.TWILIO_AUTH_TOKEN;
      expect(isTwilioWebhookAuthentic(testUrl, testParams, "some_sig")).toBe(false);
    });
  });

  describe("5. Twilio Recovery SMS Flag & Answered Call Safety", () => {
    let mockSms: DevMockSmsProvider;

    beforeEach(() => {
      mockSms = new DevMockSmsProvider();
      setSmsProviderForTesting(mockSms);
    });

    it("strictly prevents recovery SMS when dialed leg was answered", () => {
      const answered = isCallMissed({ DialCallStatus: "completed" });
      expect(answered).toBe(false);
    });

    it("does NOT send recovery SMS when TWILIO_RECOVERY_SMS_ENABLED is false", async () => {
      process.env.TWILIO_RECOVERY_SMS_ENABLED = "false";
      const callSid = `CA_test_recovery_off_${Date.now()}`;

      const res = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557711",
        DialCallStatus: "no-answer",
        CallStatus: "completed",
      });

      expect(res.handled).toBe(true);
      expect(res.isMissedCall).toBe(true);
      expect(res.smsSent).toBe(false);
      expect(mockSms.sentMessages.length).toBe(0);

      // Clean up test call event
      await db.callWebhookEvent.deleteMany({ where: { callSid } });
      if (res.leadId) {
        await db.lead.deleteMany({ where: { id: res.leadId } });
      }
    });

    it("sends recovery SMS when TWILIO_RECOVERY_SMS_ENABLED is true", async () => {
      process.env.TWILIO_RECOVERY_SMS_ENABLED = "true";
      const callSid = `CA_test_recovery_on_${Date.now()}`;

      const res = await processDialActionCallback({
        CallSid: callSid,
        From: "+19195557722",
        DialCallStatus: "busy",
        CallStatus: "completed",
      });

      expect(res.handled).toBe(true);
      expect(res.isMissedCall).toBe(true);
      expect(res.smsSent).toBe(true);
      expect(mockSms.sentMessages.length).toBe(1);

      // Clean up test call event
      await db.callWebhookEvent.deleteMany({ where: { callSid } });
      if (res.leadId) {
        await db.lead.deleteMany({ where: { id: res.leadId } });
      }
    });
  });

  describe("6. Error Sanitization in Production", () => {
    it("sanitizes Prisma and database errors in production", async () => {
      process.env.NODE_ENV = "production";

      const prismaError = new Error(
        "Invalid `db.lead.findUnique()` invocation:\nPrismaClientKnownRequestError: Table 'bookmoar.leads' does not exist."
      );
      prismaError.name = "PrismaClientKnownRequestError";

      const response = handleApiError(prismaError);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toBe("An unexpected error occurred. Please try again later.");
      expect(json.error).not.toMatch(/prisma/i);
      expect(json.error).not.toMatch(/table/i);
    });

    it("passes through Zod validation details even in production", async () => {
      process.env.NODE_ENV = "production";

      const zodError = new ZodError([
        {
          code: "invalid_string",
          validation: "email",
          message: "Invalid email address",
          path: ["email"],
        },
      ]);

      const response = handleApiError(zodError);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details).toEqual([{ path: "email", message: "Invalid email address" }]);
    });

    it("passes clean domain operational errors in production", async () => {
      process.env.NODE_ENV = "production";

      const domainError = new Error("Requested service does not exist");
      const response = handleApiError(domainError);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Requested service does not exist");
    });
  });
});
