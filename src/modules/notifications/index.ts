import { formatPhoneForDisplay } from "@/lib/phone";
import { getBusinessProfile } from "@/modules/business";

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  mock?: boolean;
  error?: string;
}

export interface SmsProvider {
  sendSms(to: string, body: string): Promise<SmsSendResult>;
}

/**
 * Production Twilio SMS implementation via Twilio REST API.
 * Uses native fetch to avoid heavy third-party SDK dependencies while remaining 100% compliant with Twilio API.
 */
export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendSms(to: string, body: string): Promise<SmsSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const authHeader = "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", this.fromNumber);
    formData.append("Body", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio SMS error:", response.status, errorText);
      return {
        success: false,
        error: `Twilio API returned ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.sid,
    };
  }
}

/**
 * Safe local development and test mock provider.
 * Logs the outbound SMS clearly to the console without contacting external APIs.
 */
export class DevMockSmsProvider implements SmsProvider {
  public sentMessages: Array<{ to: string; body: string; timestamp: Date }> = [];

  async sendSms(to: string, body: string): Promise<SmsSendResult> {
    const logEntry = { to, body, timestamp: new Date() };
    this.sentMessages.push(logEntry);
    console.log(`[DevMockSmsProvider] Outbound SMS to: ${to} | Body: "${body}"`);
    return {
      success: true,
      messageId: `mock_sms_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      mock: true,
    };
  }
}

// Global provider singleton with test override capability
let activeSmsProvider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (activeSmsProvider) return activeSmsProvider;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && fromNumber) {
    activeSmsProvider = new TwilioSmsProvider(accountSid, authToken, fromNumber);
  } else {
    activeSmsProvider = new DevMockSmsProvider();
  }

  return activeSmsProvider;
}

export function setSmsProviderForTesting(provider: SmsProvider | null) {
  activeSmsProvider = provider;
}

export interface LeadNotificationPayload {
  customerName: string;
  customerPhone: string;
  serviceName?: string | null;
}

/**
 * Dispatches an SMS notification to the business owner about a new website lead.
 * CRITICAL ARCHITECTURAL REQUIREMENT:
 * A notification failure MUST NOT reject, delete, or fail the lead creation.
 */
export async function notifyOwnerOfNewLead(lead: LeadNotificationPayload): Promise<{ notified: boolean; error?: string }> {
  try {
    const enabled = process.env.TWILIO_OWNER_NOTIFICATIONS_ENABLED !== "false";
    if (!enabled) {
      console.log("[NotificationService] Owner notifications disabled via env");
      return { notified: false };
    }

    const business = await getBusinessProfile();
    const targetPhone = business.notificationPhone || business.phone;

    if (!targetPhone) {
      console.warn("[NotificationService] No notification phone configured on business");
      return { notified: false, error: "No notification phone configured" };
    }

    const serviceDisplay = lead.serviceName ? ` — ${lead.serviceName}` : "";
    const phoneDisplay = formatPhoneForDisplay(lead.customerPhone);
    const message = `New Book Moar lead: ${lead.customerName}${serviceDisplay} — ${phoneDisplay}`;

    const provider = getSmsProvider();
    const result = await provider.sendSms(targetPhone, message);

    if (!result.success) {
      console.error("[NotificationService] Failed to send owner SMS:", result.error);
      return { notified: false, error: result.error };
    }

    return { notified: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[NotificationService] Exception while notifying owner:", errorMessage);
    // Explicitly do not rethrow - preserve lead
    return { notified: false, error: errorMessage };
  }
}
