import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class StatementPasswordCrypto {
  private readonly logger = new Logger(StatementPasswordCrypto.name);
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const envKey = this.config.get<string>('STATEMENT_PASSWORD_KEY');
    if (!envKey) {
      throw new Error(
        'STATEMENT_PASSWORD_KEY environment variable is required. ' +
        'Generate a random key (e.g. openssl rand -hex 32) and set it in .env.',
      );
    }
    this.key = crypto.createHash('sha256').update(envKey).digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(encrypted: string): string | null {
    try {
      const parts = encrypted.split(':');
      if (parts.length !== 3) return null;
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = Buffer.from(parts[2], 'base64');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (err) {
      this.logger.error(`Failed to decrypt statement password: ${err.message}`);
      return null;
    }
  }
}
