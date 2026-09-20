import { NextResponse } from "next/server";
import { generateInboundVoiceTwiml } from "@/modules/missed-call";
import { isTwilioWebhookAuthentic, reconstructWebhookUrl } from "@/lib/twilio";

/**
 * Twilio Inbound Voice Webhook
 * POST /api/webhooks/twilio/voice
 * Returns TwiML instruction to forward the call to the client's business phone.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const paramsMap: Record<string, string> = {};
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        paramsMap[key] = value.toString();
      });
    }

    const signature = req.headers.get("x-twilio-signature");
    const fullUrl = reconstructWebhookUrl(req, "/api/webhooks/twilio/voice");

    if (!isTwilioWebhookAuthentic(fullUrl, paramsMap, signature)) {
      console.warn("[TwilioWebhook] Rejected voice webhook with invalid signature");
      return new NextResponse("Unauthorized Twilio Signature", { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(fullUrl).origin;
    const twiml = await generateInboundVoiceTwiml(baseUrl);

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating voice TwiML:", error);
    // Return empty TwiML fallback rather than crashing Twilio
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unable to complete call.</Say><Hangup/></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}
