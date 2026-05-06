import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

const getKey = (): Buffer => {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(key, "hex");
};

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex).
 */
export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 128-bit authentication tag
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

/**
 * Decrypts a value produced by encrypt().
 * Returns null if the value is null/undefined.
 * Returns "[decryption-error]" if the key or ciphertext is wrong.
 */
export const decrypt = (ciphertext: string | null | undefined): string | null => {
  if (!ciphertext) return null;
  try {
    const [ivHex, tagHex, encHex] = ciphertext.split(":");
    if (!ivHex || !tagHex || !encHex) throw new Error("malformed ciphertext");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return (
      decipher.update(Buffer.from(encHex, "hex")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    return "[decryption-error]";
  }
};

// Fields to encrypt per item type
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  password: ["username", "secret", "url", "notes"],
  secret:   ["secret", "notes"],
  note:     ["content", "notes"],
  card:     ["card_number", "cvv", "notes"],
  identity: ["notes"],
};

type ItemData = Record<string, unknown>;

export const encryptItemFields = (type: string, data: ItemData): ItemData => {
  const fields = ENCRYPTED_FIELDS[type] ?? [];
  const result = { ...data };
  for (const f of fields) {
    if (result[f] && typeof result[f] === "string") {
      result[f] = encrypt(result[f] as string);
    }
  }
  return result;
};

export const decryptItemFields = (type: string, data: ItemData): ItemData => {
  const fields = ENCRYPTED_FIELDS[type] ?? [];
  const result = { ...data };
  for (const f of fields) {
    if (result[f] && typeof result[f] === "string") {
      result[f] = decrypt(result[f] as string);
    }
  }
  return result;
};
