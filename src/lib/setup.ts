/**
 * Internal setup mode helper.
 * When ENABLE_INTERNAL_SETUP is not set to "true", configuration screens
 * (/services, /business) and mutation APIs are disabled in production.
 */
export function isInternalSetupEnabled(): boolean {
  return process.env.ENABLE_INTERNAL_SETUP === "true";
}
