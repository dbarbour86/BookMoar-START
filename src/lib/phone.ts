/**
 * Normalizes an arbitrary phone string into a standard E.164-compatible format (+1XXXXXXXXXX).
 * Defaults to North America (+1) if country code is not provided and 10 digits are present.
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return "";
  
  // Strip out any non-digit character except leading plus
  const hasLeadingPlus = rawPhone.trim().startsWith("+");
  const digitsOnly = rawPhone.replace(/\D/g, "");

  if (hasLeadingPlus) {
    return `+${digitsOnly}`;
  }

  // If 10 digits (US/Canada local standard), prepend +1
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  // If 11 digits starting with 1, prepend +
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }

  // Fallback: return with plus if not empty
  return digitsOnly ? `+${digitsOnly}` : rawPhone.trim();
}

/**
 * Formats an E.164 or 10-digit phone number into a friendly display string, e.g. (919) 555-1234.
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  
  // If 11 digits starting with 1, strip the country code for display
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  return phone;
}
