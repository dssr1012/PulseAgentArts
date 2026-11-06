import * as crypto from 'crypto';
import * as fs from 'fs';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

function decryptValue(key: Buffer, encrypted: string): string {
  let value = encrypted;
  if (value.startsWith('ENC(') && value.endsWith(')')) {
    value = value.slice(4, -1);
  }
  const parts = value.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected ENC(iv:tag:ciphertext)');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function decryptEnv(): void {
  let masterKey = process.env.MASTER_ENCRYPTION_KEY;

  const keyFile = process.env.MASTER_ENCRYPTION_KEY_FILE;
  if (!masterKey && keyFile) {
    try {
      masterKey = fs.readFileSync(keyFile, 'utf8').trim();
    } catch {
      console.warn(`[SecretsCrypto] MASTER_ENCRYPTION_KEY_FILE points to ${keyFile} but file could not be read`);
    }
  }

  if (!masterKey) return;

  const key = crypto.createHash('sha256').update(masterKey).digest();

  let decryptedCount = 0;
  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (envValue && envValue.startsWith('ENC(') && envValue.endsWith(')')) {
      try {
        process.env[envKey] = decryptValue(key, envValue);
        decryptedCount++;
      } catch (err) {
        throw new Error(`Failed to decrypt environment variable ${envKey}: ${err.message}`);
      }
    }
  }

  if (decryptedCount > 0) {
    console.log(`[SecretsCrypto] Decrypted ${decryptedCount} environment variable(s) at startup`);
  }
}
