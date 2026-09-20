import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status }
  );
}

/**
 * Centralized API error handler.
 * In production:
 * - Sanitizes internal system, database, and Prisma errors.
 * - Prevents table names, SQL queries, or stack traces from reaching callers.
 * - Preserves validation details (ZodError) and safe operational feedback.
 */
export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof ZodError) {
    return jsonError(
      "Validation failed",
      400,
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  if (error instanceof Error) {
    const isProduction = process.env.NODE_ENV === "production";

    // Detect internal / database / Prisma error signatures that must be sanitized
    const isInternalError =
      error.name?.toLowerCase().includes("prisma") ||
      error.message?.toLowerCase().includes("prisma") ||
      error.message?.includes(" invocation:") ||
      error.message?.toLowerCase().includes("database") ||
      error.message?.toLowerCase().includes("connection") ||
      error.message?.toLowerCase().includes("fatal") ||
      error.message?.length > 160;

    if (isProduction && isInternalError) {
      return jsonError("An unexpected error occurred. Please try again later.", 500);
    }

    // In production, map UNAUTHORIZED to 401
    if (error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError(error.message, 400);
  }

  return jsonError("An unexpected error occurred. Please try again later.", 500);
}
