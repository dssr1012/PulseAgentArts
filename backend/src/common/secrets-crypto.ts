import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'ENC(';

export class SecretsCrypto {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY must be at least 32 characters. ' +
        'Generate one with: openssl rand -hex 32',
      );
    }
    this.key = crypto.createHash('sha256').update(masterKey).digest();
  }

  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `ENC(${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')})`;
  }

  decrypt(encrypted: string): string {
    let value = encrypted;
    if (value.startsWith(ENCRYPTED_PREFIX) && value.endsWith(')')) {
      value = value.slice(ENCRYPTED_PREFIX.length, -1);
    }
    const parts = value.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format. Expected ENC(iv:tag:ciphertext) or iv:tag:ciphertext');
    }
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX) && value.endsWith(')');
  }

  decryptIfEncrypted(value: string): string {
    if (this.isEncrypted(value)) {
      return this.decrypt(value);
    }
    return value;
  }
}
