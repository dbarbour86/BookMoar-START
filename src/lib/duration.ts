/**
 * Human-readable appointment duration helpers.
 * Internally, appointments continue to store duration as integer total minutes.
 */

/**
 * Formats integer minutes into human-readable duration strings.
 * Examples:
 * - 30 -> "30 min"
 * - 60 -> "1 hr"
 * - 90 -> "1 hr 30 min"
 * - 135 -> "2 hr 15 min"
 * - 300 -> "5 hr"
 */
export function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0 min";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} hr`;
  }
  return `${minutes} min`;
}

/**
 * Splits total duration minutes into hours and minutes for form controls.
 * If an existing appointment has an irregular duration (e.g. 70 minutes),
 * snaps to the closest 15-minute increment (0, 15, 30, 45) for dropdown selection.
 */
export function splitDurationMinutes(totalMinutes = 60): { hours: number; minutes: number } {
  const safeTotal = Math.max(0, Number(totalMinutes) || 0);
  if (safeTotal === 0) {
    return { hours: 0, minutes: 0 };
  }

  // Snap to closest 15-minute increment (at least 15 min if original was positive)
  const roundedTotal = Math.max(15, Math.round(safeTotal / 15) * 15);
  const hours = Math.floor(roundedTotal / 60);
  const minutes = roundedTotal % 60;
  return { hours, minutes };
}

/**
 * Combines hours and minutes into integer total minutes.
 * Formula: (hours * 60) + minutes
 */
export function combineDurationMinutes(hours: number | string, minutes: number | string): number {
  const safeHours = Math.max(0, Math.floor(Number(hours) || 0));
  const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  return safeHours * 60 + safeMinutes;
}
