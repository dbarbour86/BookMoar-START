import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/errors";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }
  return NextResponse.json({ user });
}
