import "server-only";
import { randomBytes } from "node:crypto";

// Citizen-facing tracking id: SMD-XXXXXXXX (8 Crockford-base32 chars, no embedded
// date) per backend-plan.md A.6. 5 random bytes = 40 bits = exactly 8 base32 chars.
// 5-bit accumulator over bytes (no BigInt — the buffer never exceeds ~12 bits, so the
// 32-bit shifts are safe).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford (no I L O U)

export function trackingId(): string {
  let value = 0;
  let bits = 0;
  let out = "";
  for (const b of randomBytes(5)) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
  }
  return `SMD-${out}`;
}
