import { NextResponse } from "next/server";
import { processDialActionCallback, TwilioVoiceWebhookPayload } from "@/modules/missed-call";
import { isTwilioWebhookAuthentic, reconstructWebhookUrl } from "@/lib/twilio";

/**
 * Twilio Dial Action Callback Webhook
 * POST /api/webhooks/twilio/dial-action
 * Receives the outcome of the dialed leg (DialCallStatus) and triggers recovery SMS if missed.
 */
export async function POST(req: Request) {
  try {
    let payload: Partial<TwilioVoiceWebhookPayload> = {};
    const paramsMap: Record<string, string> = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        paramsMap[key] = value.toString();
      });
      payload = {
        CallSid: paramsMap.CallSid || "",
        From: paramsMap.From || "",
        To: paramsMap.To || "",
        CallStatus: paramsMap.CallStatus || "",
        DialCallStatus: paramsMap.DialCallStatus || "",
        DialCallDuration: paramsMap.DialCallDuration || "",
      };
    } else {
      payload = await req.json();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) paramsMap[k] = String(v);
      });
    }

    const signature = req.headers.get("x-twilio-signature");
    const fullUrl = reconstructWebhookUrl(req, "/api/webhooks/twilio/dial-action");

    if (!isTwilioWebhookAuthentic(fullUrl, paramsMap, signature)) {
      console.warn("[TwilioWebhook] Rejected dial-action webhook with invalid signature");
      return new NextResponse("Unauthorized Twilio Signature", { status: 403 });
    }

    const result = await processDialActionCallback(payload as TwilioVoiceWebhookPayload);

    // Return TwiML response to finish call leg cleanly
    const responseTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
    return new NextResponse(responseTwiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "X-BookMoar-Result": JSON.stringify(result),
      },
    });
  } catch (error) {
    console.error("Error processing dial-action webhook:", error);
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
