import { NextResponse } from "next/server";
import { generateInboundVoiceTwiml } from "@/modules/missed-call";

/**
 * Twilio Inbound Voice Webhook
 * POST /api/webhooks/twilio/voice
 * Returns TwiML instruction to forward the call to the client's business phone.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
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
