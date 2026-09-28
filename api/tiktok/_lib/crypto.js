import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TikTok access/refresh tokens are encrypted at rest in Redis with
// AES-256-GCM so that a Redis data leak alone doesn't hand over live
// TikTok credentials. TOKEN_ENCRYPTION_KEY must decode (base64 or hex) to
// exactly 32 bytes — see .env.example for how to generate one.
function loadKey(encryptionKey) {
  const buf = /^[0-9a-f]{64}$/i.test(encryptionKey)
    ? Buffer.from(encryptionKey, "hex")
    : Buffer.from(encryptionKey, "base64");

  if (buf.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex-encoded). " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return buf;
}

export function encrypt(plaintext, encryptionKey) {
  const key = loadKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload, encryptionKey) {
  const key = loadKey(encryptionKey);
  const [ivB64, tagB64, ciphertextB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function verifySignature(value, signature, secret) {
  const expected = sign(value, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}
