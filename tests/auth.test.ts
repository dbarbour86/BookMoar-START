import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "@/lib/auth";

describe("Authentication & Session Security", () => {
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const rawPassword = "SecurePassword123!";
  let userId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword(rawPassword);
    const user = await db.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: "Test Owner",
        role: "OWNER",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: testEmail } });
  });

  it("hashes passwords securely with bcrypt and never stores plaintext", async () => {
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe(rawPassword);
    expect(user!.passwordHash.startsWith("$2")).toBe(true);

    const isMatch = await verifyPassword(rawPassword, user!.passwordHash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword("WrongPassword", user!.passwordHash);
    expect(isWrongMatch).toBe(false);
  });

  it("creates and verifies signed JWT session tokens", async () => {
    const payload = {
      userId,
      email: testEmail,
      role: "OWNER",
      name: "Test Owner",
    };

    const token = await createSessionToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const verified = await verifySessionToken(token);
    expect(verified).toBeDefined();
    expect(verified!.userId).toBe(userId);
    expect(verified!.role).toBe("OWNER");
  });

  it("rejects tampered or malformed session tokens", async () => {
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature";
    const result = await verifySessionToken(invalidToken);
    expect(result).toBeNull();
  });
});
