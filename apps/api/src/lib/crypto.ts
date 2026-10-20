import argon2 from "argon2";
import { createHash, randomBytes } from "crypto";

/**
 * OWASP-style argon2id parameters for NEW hashes. Verification reads the
 * parameters embedded in each stored hash, so older (slower) hashes still
 * verify — they just cost more until the password is re-hashed.
 */
const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  return argon2.verify(hash, pin);
}
