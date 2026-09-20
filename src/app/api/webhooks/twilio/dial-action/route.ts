import { NextResponse } from "next/server";
import { processDialActionCallback, TwilioVoiceWebhookPayload } from "@/modules/missed-call";

/**
 * Twilio Dial Action Callback Webhook
 * POST /api/webhooks/twilio/dial-action
 * Receives the outcome of the dialed leg (DialCallStatus) and triggers recovery SMS if missed.
 */
export async function POST(req: Request) {
  try {
    let payload: Partial<TwilioVoiceWebhookPayload> = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      payload = {
        CallSid: formData.get("CallSid")?.toString() || "",
        From: formData.get("From")?.toString() || "",
        To: formData.get("To")?.toString() || "",
        CallStatus: formData.get("CallStatus")?.toString() || "",
        DialCallStatus: formData.get("DialCallStatus")?.toString() || "",
        DialCallDuration: formData.get("DialCallDuration")?.toString() || "",
      };
    } else {
      payload = await req.json();
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
