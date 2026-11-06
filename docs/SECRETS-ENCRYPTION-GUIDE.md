# Secrets Encryption Guide

This document describes how PulseAgentArts encrypts sensitive keys and secret keys (SKs) at rest,
how to generate the encryption seed (master key), and how to protect it.

---

## Overview

All secrets in `.env` files (database passwords, SMTP passwords, Huawei Cloud AK/SK, API keys, etc.)
are encrypted using **AES-256-GCM** authenticated encryption. A single **master encryption key**
(the "seed") is used to encrypt and decrypt all individual secrets.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Master Key     │────▶│  AES-256-GCM     │────▶│  ENC(iv:tag:cipher) │
│  (seed, 256-bit)│     │  encrypt/decrypt │     │  stored in .env     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

**Why AES-256-GCM?**
- **Authenticated encryption** — detects tampering (GCM auth tag)
- **Same algorithm** already used for statement password encryption in the app
- **No external dependencies** — uses Node.js built-in `crypto` module
- **Industry standard** — NIST-approved, used by TLS 1.3

---

## Step 1 — Generate the Master Encryption Key (Seed)

The master key is a 256-bit random value encoded as a 64-character hex string.

### Option A: Using the secrets-manager tool (recommended)

```bash
cd backend
node scripts/secrets-manager.js generate-key
```

Output (example — yours will differ):
```
a3f1b2c4d5e6f7081920a1b2c3d4e5f60718293a4b5c6d7e8f90123456789ab

--- IMPORTANT ---
This is your MASTER ENCRYPTION KEY (seed).
Store it SECURELY (see docs/SECRETS-ENCRYPTION-GUIDE.md).
Do NOT commit it to the repository.
Do NOT lose it — encrypted secrets cannot be recovered without it.
```

### Option B: Using OpenSSL

```bash
openssl rand -hex 32
```

### Option C: Using /dev/urandom

```bash
head -c 32 /dev/urandom | xxd -p -c 64
```

> **The seed is 64 hex characters (256 bits).** Save it immediately to a secure location
> (see Step 4 below). It is shown only once and cannot be recovered if lost.

---

## Step 2 — Encrypt Your Secrets

### Encrypt all secrets in an `.env` file at once

```bash
cd backend

# Set the master key as an environment variable (don't put it in the .env file you're encrypting)
export MASTER_ENCRYPTION_KEY="a3f1b2c4d5e6f7081920a1b2c3d4e5f60718293a4b5c6d7e8f90123456789ab"

# Encrypt all known secret variables in .env (creates a backup first)
cp .env .env.backup.$(date +%Y%m%d)
node scripts/secrets-manager.js encrypt-env .env
```

This automatically detects and encrypts these variables:
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `SMTP_PASS`
- `STATEMENT_PASSWORD_KEY`
- `JWT_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `LTS_AK` (Huawei Cloud Access Key)
- `LTS_SK` (Huawei Cloud Secret Key)
- `FX_API_KEY`

**Before encryption:**
```env
POSTGRES_PASSWORD=mysecretpassword
LTS_AK=AKXXXXXXXXXXXXXXX
LTS_SK=SKYYYYYYYYYYYYYYYYYYY
SMTP_PASS=re_abc123def456
```

**After encryption:**
```env
POSTGRES_PASSWORD=ENC(Gy7bK9p2...==:Qf3mN8x1...==:Vt5wL2j7...==)
LTS_AK=ENC(Ab3cD5e7...==:Rk9mP2x4...==:Wn6qT8j3...==)
LTS_SK=ENC(Cd5eF7g9...==:Sm1pT4x6...==:Xp8rV3j5...==)
SMTP_PASS=ENC(Ef7gH9i1...==:Tn3qV6x8...==:Yq1sW5j7...==)
```

### Encrypt a single value

```bash
export MASTER_ENCRYPTION_KEY="your-master-key-hex"
node scripts/secrets-manager.js encrypt "my-secret-value"
# Output: ENC(Gy7bK9p2...==:Qf3mN8x1...==:Vt5wL2j7...==)
```

Copy the `ENC(...)` output into your `.env` file:
```env
LTS_SK=ENC(Gy7bK9p2...==:Qf3mN8x1...==:Vt5wL2j7...==)
```

### Verify an encrypted value

```bash
export MASTER_ENCRYPTION_KEY="your-master-key-hex"
node scripts/secrets-manager.js verify "ENC(Gy7bK9p2...==:Qf3mN8x1...==:Vt5wL2j7...==)"
# Output: OK — decrypted successfully (20 chars)
```

---

## Step 3 — Decrypt at Runtime

The application automatically decrypts `ENC(...)` values at startup when the `MASTER_ENCRYPTION_KEY`
environment variable is set. You do not need to manually decrypt secrets for the app to run.

### How it works

1. The `MASTER_ENCRYPTION_KEY` is provided to the container via environment variable or a secure
   file (see Step 4).
2. At startup, `SecretsCrypto` reads the master key and initializes the AES-256-GCM cipher.
3. The `ConfigService` wrapper detects any `ENC(...)` values and transparently decrypts them.
4. The rest of the application receives plaintext secrets as if they were never encrypted.

### Decrypt for debugging / inspection

```bash
export MASTER_ENCRYPTION_KEY="your-master-key-hex"

# Decrypt a single value
node scripts/secrets-manager.js decrypt "ENC(Gy7bK9p2...==:Qf3mN8x1...==:Vt5wL2j7...==)"
# Output: my-secret-value

# Decrypt an entire .env file (writes to a new file — never overwrite your encrypted .env)
node scripts/secrets-manager.js decrypt-env .env .env.decrypted
```

> **Warning:** Delete `.env.decrypted` immediately after inspection. Never commit decrypted files.

---

## Step 4 — Protecting the Master Key (Seed)

The master key is the **single most sensitive value** in the system. Anyone with the master key
can decrypt all secrets. Protect it with layered defenses:

### 4.1 — Never commit it to the repository

The `.gitignore` already excludes `.env` files. Verify:
```bash
git check-ignore .env .env.local .env.production
# Should print all three filenames (meaning they are ignored)
```

### 4.2 — Store it in a secrets manager (production)

| Option | How | Best for |
|--------|-----|----------|
| **Huawei Cloud KMS / DEW** | Store the master key in Key Management Service; app fetches it at startup via SDK | Production on Huawei Cloud |
| **HashiCorp Vault** | `vault kv put secret/pulseagentarts MASTER_ENCRYPTION_KEY=...`; app reads via Vault agent | Multi-cloud / on-prem |
| **Docker Secrets** | `echo "..." \| docker secret create master_key -`; mount as `/run/secrets/master_key` | Docker Swarm |
| **Kubernetes Secrets** | `kubectl create secret generic master-key --from-literal=MASTER_ENCRYPTION_KEY=...` | K8s deployments |
| **Environment variable at deploy** | Set in CI/CD pipeline or cloud console; never in code | Simple deployments |

### 4.3 — Store it in a restricted file (development / single-server)

```bash
# Create a file readable only by the application user (mode 0600)
echo "MASTER_ENCRYPTION_KEY=a3f1b2c4..." > /etc/pulseagentarts/master-key
chmod 600 /etc/pulseagentarts/master-key
chown pulseapp:pulseapp /etc/pulseagentarts/master-key
```

Then load it in your startup script or Docker Compose:
```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      MASTER_ENCRYPTION_KEY_FILE: /run/secrets/master_key
    secrets:
      - master_key
secrets:
  master_key:
    file: /etc/pulseagentarts/master-key
```

### 4.4 — Restrict to the principle of least privilege

- Only the **application service account** should be able to read the master key.
- **No human** should have routine access to the plaintext master key in production.
- Access to the secrets manager (KMS/Vault) should be scoped to the app's IAM role only.
- Audit all access to the master key (KMS access logs, Vault audit logs).

### 4.5 — Backup the master key offline

If the master key is lost, **all encrypted secrets become permanently unrecoverable**.

- Store a sealed offline copy in a physical safe or a password-protected USB drive.
- Split the key using Shamir's Secret Sharing (e.g., `ssss-split`) across 3 custodians,
  requiring 2 to reconstruct.
- Document the recovery procedure in your runbook.

---

## Step 5 — Key Rotation

### Rotate the master key

1. Generate a new master key:
   ```bash
   node scripts/secrets-manager.js generate-key
   ```

2. Decrypt all secrets with the **old** key:
   ```bash
   export MASTER_ENCRYPTION_KEY="OLD_KEY"
   node scripts/secrets-manager.js decrypt-env .env .env.tmp
   ```

3. Re-encrypt with the **new** key:
   ```bash
   export MASTER_ENCRYPTION_KEY="NEW_KEY"
   node scripts/secrets-manager.js encrypt-env .env.tmp .env
   rm .env.tmp
   ```

4. Update the master key in your secrets manager / environment.
5. Restart the application.

### Rotate an individual secret (e.g., LTS SK)

1. Obtain the new secret value from Huawei Cloud console.
2. Encrypt it with the current master key:
   ```bash
   export MASTER_ENCRYPTION_KEY="your-current-master-key"
   node scripts/secrets-manager.js encrypt "NEW_SK_VALUE"
   ```
3. Replace the `LTS_SK=ENC(...)` line in `.env` with the new encrypted value.
4. Restart the affected service (e.g., Fluent Bit for LTS, backend for SMTP).

---

## Encrypted Value Format

```
ENC(base64(iv):base64(authTag):base64(ciphertext))
```

| Component | Size | Purpose |
|-----------|------|---------|
| `iv` | 12 bytes | Initialization vector (unique per encryption) |
| `authTag` | 16 bytes | GCM authentication tag (tamper detection) |
| `ciphertext` | variable | The encrypted plaintext |
| `ENC(...)` wrapper | — | Marker so the app knows this value is encrypted |

The same plaintext encrypted twice produces different ciphertext (due to the random IV),
so encrypted values are not comparable by string equality.

---

## Quick Reference

```bash
# 1. Generate master key
node scripts/secrets-manager.js generate-key

# 2. Set it as env var
export MASTER_ENCRYPTION_KEY="generated-key-hex"

# 3. Encrypt all secrets in .env
cp .env .env.backup
node scripts/secrets-manager.js encrypt-env .env

# 4. Verify a specific encrypted value
node scripts/secrets-manager.js verify "ENC(...)" 

# 5. Decrypt for debugging (to a temp file, never overwrite)
node scripts/secrets-manager.js decrypt-env .env .env.debug

# 6. Rotate master key
node scripts/secrets-manager.js generate-key  # new key
# ...follow Step 5 rotation procedure
```

---

## Security Checklist

- [ ] Master key is at least 64 hex characters (256 bits)
- [ ] Master key is stored in a secrets manager or restricted file (mode 0600)
- [ ] Master key is **not** in any `.env` file committed to git
- [ ] Master key is **not** in CI/CD logs or container logs
- [ ] `.env` files containing `ENC(...)` values are gitignored
- [ ] Offline backup of the master key exists (safe / SSSS)
- [ ] Only the application service account can read the master key
- [ ] Access to the master key is audited
- [ ] Decrypted temp files (`.env.debug`, `.env.decrypted`) are deleted after use
