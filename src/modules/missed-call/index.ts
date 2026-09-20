import { db } from "@/lib/db";
import { normalizePhone, formatPhoneForDisplay } from "@/lib/phone";
import { getBusinessProfile } from "@/modules/business";
import { getSmsProvider } from "@/modules/notifications";
import { LeadSource, LeadStatus } from "@prisma/client";

export interface TwilioVoiceWebhookPayload {
  CallSid: string;
  From: string;
  To?: string;
  CallStatus?: string;
  DialCallStatus?: string;
  DialCallDuration?: string;
}

export interface MissedCallResult {
  handled: boolean;
  isMissedCall: boolean;
  smsSent: boolean;
  duplicate: boolean;
  leadId?: string;
  reason?: string;
}

/**
 * Determines whether a Twilio call event represents a missed / unanswered call.
 * PRIMARY SAFETY RULE:
 * Book Moar must NEVER send "Sorry we missed your call" after the business
 * successfully answered and spoke with the caller.
 *
 * Evaluation order:
 * 1. If DialCallStatus === "completed" -> Answered -> FALSE
 * 2. If DialCallStatus in ["no-answer", "busy", "failed", "canceled"] -> Missed -> TRUE
 * 3. If no DialCallStatus, check top-level CallStatus:
 *    - "no-answer", "busy", "failed", "canceled" -> Missed -> TRUE
 *    - "completed" without DialCallStatus -> Treat safely as NOT missed -> FALSE
 */
export function isCallMissed(payload: { DialCallStatus?: string; CallStatus?: string }): boolean {
  const dialStatus = payload.DialCallStatus?.toLowerCase();
  const topStatus = payload.CallStatus?.toLowerCase();

  // 1. If dialed leg completed, the business answered the call!
  if (dialStatus === "completed") {
    return false;
  }

  // 2. If dialed leg was not completed (no-answer, busy, failed, canceled)
  if (dialStatus && ["no-answer", "busy", "failed", "canceled"].includes(dialStatus)) {
    return true;
  }

  // 3. If no dial status was present, inspect top-level call status
  if (topStatus && ["no-answer", "busy", "failed", "canceled"].includes(topStatus)) {
    return true;
  }

  // Any other status (including raw "completed" or in-progress) must not trigger recovery
  return false;
}

/**
 * Handles incoming voice webhook by generating TwiML to forward the call
 * to the business phone, configuring the dial action callback.
 */
export async function generateInboundVoiceTwiml(actionBaseUrl: string): Promise<string> {
  const business = await getBusinessProfile();
  const forwardToPhone = business.phone;

  // 25 second timeout (~4-5 rings) before Twilio treats it as no-answer
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${actionBaseUrl}/api/webhooks/twilio/dial-action" timeout="25">
    <Number>${forwardToPhone}</Number>
  </Dial>
</Response>`;
}

/**
 * Processes the Dial Action callback from Twilio.
 * Performs:
 * 1. Missed call determination (strictly checking that business didn't answer)
 * 2. Webhook idempotency via CallSid
 * 3. Duplicate lead association for open leads within 24h
 * 4. Recovery SMS dispatch using business configuration template
 */
export async function processDialActionCallback(payload: TwilioVoiceWebhookPayload): Promise<MissedCallResult> {
  const { CallSid, From, DialCallStatus, CallStatus } = payload;

  if (!CallSid || !From) {
    return {
      handled: false,
      isMissedCall: false,
      smsSent: false,
      duplicate: false,
      reason: "Missing CallSid or From in payload",
    };
  }

  // 1. Check idempotency: Have we already processed this CallSid?
  const existingEvent = await db.callWebhookEvent.findUnique({
    where: { callSid: CallSid },
  });

  if (existingEvent && (existingEvent.processed || existingEvent.smsSent)) {
    console.log(`[MissedCall] Duplicate webhook event ignored for CallSid: ${CallSid}`);
    return {
      handled: true,
      isMissedCall: existingEvent.smsSent,
      smsSent: false,
      duplicate: true,
      leadId: existingEvent.leadId || undefined,
      reason: "Duplicate event already processed",
    };
  }

  // 2. Determine if call was missed
  const missed = isCallMissed({ DialCallStatus, CallStatus });

  if (!missed) {
    console.log(`[MissedCall] Call was answered or not missed (DialCallStatus=${DialCallStatus}, CallStatus=${CallStatus}). No SMS.`);
    await db.callWebhookEvent.upsert({
      where: { callSid: CallSid },
      create: {
        callSid: CallSid,
        from: From,
        callStatus: CallStatus || "completed",
        dialCallStatus: DialCallStatus || null,
        processed: true,
        smsSent: false,
      },
      update: {
        callStatus: CallStatus || "completed",
        dialCallStatus: DialCallStatus || null,
        processed: true,
      },
    });

    return {
      handled: true,
      isMissedCall: false,
      smsSent: false,
      duplicate: false,
      reason: "Call was answered or completed successfully",
    };
  }

  // 3. Call was MISSED. Find or create lead using phone deduplication policy
  const normalizedPhone = normalizePhone(From);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check if there is an existing OPEN lead (NEW or CONTACTED) in the last 24 hours
  const existingOpenLead = await db.lead.findFirst({
    where: {
      normalizedPhone,
      status: {
        in: [LeadStatus.NEW, LeadStatus.CONTACTED],
      },
      createdAt: {
        gte: twentyFourHoursAgo,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let targetLeadId: string;

  if (existingOpenLead) {
    // Associate with existing open lead, update note & timestamp
    const updatedLead = await db.lead.update({
      where: { id: existingOpenLead.id },
      data: {
        message: existingOpenLead.message
          ? `${existingOpenLead.message}\n[Missed Call logged: ${new Date().toLocaleTimeString()}]`
          : `[Missed Call logged: ${new Date().toLocaleTimeString()}]`,
        updatedAt: new Date(),
      },
    });
    targetLeadId = updatedLead.id;
    console.log(`[MissedCall] Associated missed call with existing open lead: ${targetLeadId}`);
  } else {
    // Create new Lead for this missed call
    const friendlyFrom = formatPhoneForDisplay(From);
    const newLead = await db.lead.create({
      data: {
        name: `Missed Call (${friendlyFrom})`,
        phone: From,
        normalizedPhone,
        message: "Inbound call missed. Automated recovery text sent.",
        source: LeadSource.MISSED_CALL,
        status: LeadStatus.NEW,
      },
    });
    targetLeadId = newLead.id;
    console.log(`[MissedCall] Created new MISSED_CALL lead: ${targetLeadId}`);
  }

  // 4. Send Recovery SMS
  const business = await getBusinessProfile();
  const smsTemplate = business.missedCallTextTemplate || "Hey! Sorry we missed your call. How can we help?";

  let smsSent = false;
  try {
    const provider = getSmsProvider();
    const smsResult = await provider.sendSms(From, smsTemplate);
    smsSent = smsResult.success;
  } catch (smsError) {
    console.error("[MissedCall] Failed to send recovery SMS:", smsError);
  }

  // 5. Record CallWebhookEvent for idempotency
  await db.callWebhookEvent.upsert({
    where: { callSid: CallSid },
    create: {
      callSid: CallSid,
      from: From,
      callStatus: CallStatus || "no-answer",
      dialCallStatus: DialCallStatus || null,
      processed: true,
      leadId: targetLeadId,
      smsSent,
    },
    update: {
      callStatus: CallStatus || "no-answer",
      dialCallStatus: DialCallStatus || null,
      processed: true,
      leadId: targetLeadId,
      smsSent,
    },
  });

  return {
    handled: true,
    isMissedCall: true,
    smsSent,
    duplicate: false,
    leadId: targetLeadId,
  };
}
