#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(masterKey) {
  if (!masterKey || masterKey.length < 32) {
    console.error('ERROR: Master key must be at least 32 characters.');
    console.error('Generate one with: node scripts/secrets-manager.js generate-key');
    process.exit(1);
  }
  return crypto.createHash('sha256').update(masterKey).digest();
}

function encryptValue(key, plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `ENC(${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')})`;
}

function decryptValue(key, encrypted) {
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

function generateKey() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log(key);
  console.error('\n--- IMPORTANT ---');
  console.error('This is your MASTER ENCRYPTION KEY (seed).');
  console.error('Store it SECURELY (see docs/SECRETS-ENCRYPTION-GUIDE.md).');
  console.error('Do NOT commit it to the repository.');
  console.error('Do NOT lose it — encrypted secrets cannot be recovered without it.');
}

function encryptEnvFile(envPath, masterKey, output) {
  const key = deriveKey(masterKey);
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  const secretPatterns = [
    'POSTGRES_PASSWORD',
    'REDIS_PASSWORD',
    'SMTP_PASS',
    'STATEMENT_PASSWORD_KEY',
    'JWT_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'LTS_AK',
    'LTS_SK',
    'FX_API_KEY',
    'MASTER_ENCRYPTION_KEY',
  ];

  let encryptedCount = 0;
  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    const eqIdx = line.indexOf('=');
    const varName = line.substring(0, eqIdx).trim();
    const varValue = line.substring(eqIdx + 1).trim();
    if (!secretPatterns.includes(varName)) return line;
    if (!varValue || varValue.startsWith('ENC(')) return line;
    if (varName === 'MASTER_ENCRYPTION_KEY') return line;
    const encrypted = encryptValue(key, varValue);
    encryptedCount++;
    return `${varName}=${encrypted}`;
  });

  const outPath = output || envPath;
  fs.writeFileSync(outPath, result.join('\n'), { mode: 0o600 });
  console.log(`Encrypted ${encryptedCount} secret(s) in ${outPath}`);
}

function decryptEnvFile(envPath, masterKey, output) {
  const key = deriveKey(masterKey);
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  let decryptedCount = 0;
  const result = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    const eqIdx = line.indexOf('=');
    const varName = line.substring(0, eqIdx).trim();
    let varValue = line.substring(eqIdx + 1).trim();
    if (!varValue.startsWith('ENC(')) return line;
    const decrypted = decryptValue(key, varValue);
    decryptedCount++;
    return `${varName}=${decrypted}`;
  });

  const outPath = output || envPath;
  fs.writeFileSync(outPath, result.join('\n'), { mode: 0o600 });
  console.log(`Decrypted ${decryptedCount} secret(s) in ${outPath}`);
}

function encryptOne(masterKey, plaintext) {
  const key = deriveKey(masterKey);
  console.log(encryptValue(key, plaintext));
}

function decryptOne(masterKey, encrypted) {
  const key = deriveKey(masterKey);
  console.log(decryptValue(key, encrypted));
}

function verify(masterKey, encrypted) {
  const key = deriveKey(masterKey);
  try {
    const plaintext = decryptValue(key, encrypted);
    console.log(`OK — decrypted successfully (${plaintext.length} chars)`);
  } catch (err) {
    console.error(`FAIL — ${err.message}`);
    process.exit(1);
  }
}

const command = process.argv[2];
const masterKey = process.env.MASTER_ENCRYPTION_KEY || process.argv[4];

switch (command) {
  case 'generate-key':
    generateKey();
    break;
  case 'encrypt':
    if (!process.argv[3]) { console.error('Usage: secrets-manager.js encrypt <plaintext> [master-key]'); process.exit(1); }
    if (!masterKey) { console.error('Master key required: pass as 2nd arg or set MASTER_ENCRYPTION_KEY env var'); process.exit(1); }
    encryptOne(masterKey, process.argv[3]);
    break;
  case 'decrypt':
    if (!process.argv[3]) { console.error('Usage: secrets-manager.js decrypt <ENC(...)> [master-key]'); process.exit(1); }
    if (!masterKey) { console.error('Master key required: pass as 2nd arg or set MASTER_ENCRYPTION_KEY env var'); process.exit(1); }
    decryptOne(masterKey, process.argv[3]);
    break;
  case 'encrypt-env': {
    if (!process.argv[3]) { console.error('Usage: secrets-manager.js encrypt-env <env-file> [master-key] [output]'); process.exit(1); }
    let ek, eo;
    if (process.env.MASTER_ENCRYPTION_KEY) { ek = process.env.MASTER_ENCRYPTION_KEY; eo = process.argv[4]; }
    else { ek = process.argv[4]; eo = process.argv[5]; }
    if (!ek) { console.error('Master key required: pass as 2nd arg or set MASTER_ENCRYPTION_KEY env var'); process.exit(1); }
    encryptEnvFile(process.argv[3], ek, eo);
    break;
  }
  case 'decrypt-env': {
    if (!process.argv[3]) { console.error('Usage: secrets-manager.js decrypt-env <env-file> [master-key] [output]'); process.exit(1); }
    let dk, dOut;
    if (process.env.MASTER_ENCRYPTION_KEY) { dk = process.env.MASTER_ENCRYPTION_KEY; dOut = process.argv[4]; }
    else { dk = process.argv[4]; dOut = process.argv[5]; }
    if (!dk) { console.error('Master key required: pass as 2nd arg or set MASTER_ENCRYPTION_KEY env var'); process.exit(1); }
    decryptEnvFile(process.argv[3], dk, dOut);
    break;
  }
  case 'verify':
    if (!process.argv[3]) { console.error('Usage: secrets-manager.js verify <ENC(...)> [master-key]'); process.exit(1); }
    if (!masterKey) { console.error('Master key required: pass as 2nd arg or set MASTER_ENCRYPTION_KEY env var'); process.exit(1); }
    verify(masterKey, process.argv[3]);
    break;
  default:
    console.log('PulseAgentArts Secrets Manager');
    console.log('');
    console.log('Commands:');
    console.log('  generate-key                    Generate a new 256-bit master encryption key (hex)');
    console.log('  encrypt <plaintext> [key]       Encrypt a single value');
    console.log('  decrypt <ENC(...)> [key]        Decrypt a single ENC(...) value');
    console.log('  encrypt-env <file> [key] [out]  Encrypt all known secret vars in an .env file');
    console.log('  decrypt-env <file> [key] [out]  Decrypt all ENC(...) values in an .env file');
    console.log('  verify <ENC(...)> [key]         Verify that a value decrypts successfully');
    console.log('');
    console.log('The master key can be passed as the last arg or via MASTER_ENCRYPTION_KEY env var.');
    console.log('See docs/SECRETS-ENCRYPTION-GUIDE.md for the full procedure.');
    break;
}
