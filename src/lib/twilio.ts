import crypto from "crypto";

/**
 * Validates a Twilio request signature against the expected URL and POST parameters.
 * Follows Twilio's official validation specification:
 * 1. Takes the full URL of the webhook request.
 * 2. Takes the POST parameters and sorts the keys alphabetically.
 * 3. Concatenates each key and its value directly to the URL.
 * 4. Signs the string with HMAC-SHA1 using TWILIO_AUTH_TOKEN.
 * 5. Compares with the X-Twilio-Signature header using timingSafeEqual.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string | undefined
): boolean {
  if (!signature || !authToken) {
    return false;
  }

  try {
    // 1. Sort the parameter keys alphabetically
    const sortedKeys = Object.keys(params).sort();

    // 2. Concatenate the URL and key-value pairs
    let data = url;
    for (const key of sortedKeys) {
      data += key + (params[key] || "");
    }

    // 3. Compute HMAC-SHA1
    const hmac = crypto.createHmac("sha1", authToken);
    hmac.update(Buffer.from(data, "utf-8"));
    const expectedSignature = hmac.digest("base64");

    // 4. Constant-time comparison
    const sigBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Reconstructs the canonical full webhook URL for Twilio signature validation,
 * taking into account reverse proxies, Netlify headers, or configured NEXT_PUBLIC_APP_URL.
 */
export function reconstructWebhookUrl(req: Request, path: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const base = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    return `${base}${path}`;
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}${path}`;
}

/**
 * Determines whether an incoming Twilio webhook request is authentic.
 * - In production: Fails closed. Requires TWILIO_AUTH_TOKEN and a valid X-Twilio-Signature.
 * - In development / test: If signature is provided, it must be valid. If omitted, allows for local/test mocking.
 */
export function isTwilioWebhookAuthentic(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (process.env.NODE_ENV === "production") {
    if (!authToken || !signatureHeader) {
      return false;
    }
    return validateTwilioSignature(fullUrl, params, signatureHeader, authToken);
  }

  // Development / Test
  if (signatureHeader && authToken) {
    return validateTwilioSignature(fullUrl, params, signatureHeader, authToken);
  }

  return true;
}
