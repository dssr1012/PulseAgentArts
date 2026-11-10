# PulseAgentArts

> Family Expense Management Platform — full-stack monorepo with web, mobile, backend API, and AI agent integration.

Track, manage, and visualize family expenses with multi-currency support, intelligent anomaly detection, WhatsApp ingestion, PDF statement parsing, and family circle collaboration.

---

## Features

- **Family Circles** — create groups, invite members, share expenses with role-based access (admin/member)
- **Multi-Currency** — ARS, USD, EUR with automatic exchange rate conversion
- **Credit Cards & Statements** — upload PDF statements, automatic line-item extraction and categorization
- **WhatsApp Ingestion** — connect WhatsApp groups via Baileys, auto-parse expense messages (`gaste 1500 en super`)
- **Anomaly Detection** — flag unusual spending patterns, orphaned transactions, and irregular amounts
- **Dark Mode** — system-aware theme toggle in Settings (via `next-themes`)
- **Google OAuth2** — sign in with Google alongside email/password auth
- **Structured Logging** — Pino JSON logs → Fluent Bit → Huawei Cloud LTS for centralized observability
- **AI Agent** — MCP (Model Context Protocol) server for programmatic expense queries
- **Security** — JWT (RS256), Argon2 password hashing, AES-256-GCM encryption at rest, account lockout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, Node.js 22, TypeScript 5.8 |
| **Frontend** | Next.js 16, React 19, Tailwind CSS |
| **Mobile** | Expo 57, React Native 0.86 |
| **Database** | PostgreSQL 16 + Prisma ORM 5.22 |
| **Cache** | Redis 7 (ioredis) |
| **Auth** | JWT (RS256) + Passport + Argon2 + Google OAuth2 |
| **Logging** | Pino → Fluent Bit → Huawei Cloud LTS |
| **WhatsApp** | Baileys (@whiskeysockets) |
| **Email** | Nodemailer (Resend SMTP) |
| **AI Agent** | Model Context Protocol (MCP) SDK |
| **Container** | Docker (node:22) |
| **CI/CD** | GitHub Actions |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full technology stack with versions and the system architecture diagram.

---

## Project Structure

```
PulseAgentArts/
├── backend/              # NestJS API server (port 3000)
│   ├── src/              # Feature modules (auth, circle, transactions, cards, ...)
│   ├── prisma/           # Schema and seed scripts
│   ├── scripts/          # Secrets manager utility
│   └── keys/             # JWT RSA keypairs (gitignored)
├── web/                  # Next.js frontend (port 3001)
│   └── src/
│       ├── app/          # App Router pages
│       ├── components/   # UI + layout components
│       ├── contexts/     # Auth + Toast contexts
│       └── lib/          # API client + utilities
├── mobile/               # Expo React Native app
├── mcp-server/           # MCP AI agent server
├── docs/                 # Architecture + integration guides
├── fluent-bit/           # Fluent Bit config for LTS log shipping
├── docker-compose.yml    # Local dev (PostgreSQL + Redis)
├── docker-compose.prod.yml  # Production stack (all services + Fluent Bit)
├── .env.example          # Environment variable template
└── package.json          # Workspace root scripts
```

---

## Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Docker** + Docker Compose (for PostgreSQL/Redis)
- **OpenSSL** (for generating JWT keys and encryption seeds)

---

## Quick Start

### 1. Clone and install

```bash
git clone git@github.com:dssr1012/PulseAgentArts.git
cd PulseAgentArts
npm run install:all
```

### 2. Start PostgreSQL and Redis

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and generate STATEMENT_PASSWORD_KEY:
#   openssl rand -hex 32
docker compose up -d
```

### 3. Generate JWT RSA keys

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
```

### 4. Initialize the database

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

### 5. Run the backend and frontend

```bash
npm run dev:all
```

- Backend API: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/docs`
- Web app: `http://localhost:3001`

---

## Configuration

All configuration is via environment variables. Copy the appropriate template and fill in your values:

| Template | Use case |
|----------|----------|
| `.env.example` | General template with all variables |
| `.env.development.example` | Local development (Ethereal SMTP, debug logging) |
| `.env.production.example` | Production (Resend SMTP, info logging, secure cookies) |

**Never commit the real `.env` file** — it is gitignored. All example templates use `CHANGE_ME` placeholders.

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | RSA keypair paths for JWT signing |
| `STATEMENT_PASSWORD_KEY` | AES-256-GCM master key for encrypting sensitive data at rest |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth2 credentials |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email service configuration |
| `LTS_AK` / `LTS_SK` / `LTS_GROUP_ID` / `LTS_STREAM_ID` | Huawei Cloud LTS credentials for log shipping |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install dependencies for all workspaces |
| `npm run dev:all` | Start backend + web in dev mode |
| `npm run build` | Build backend + web + MCP server |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run unit tests (backend + web) |
| `npm run test:e2e` | Run backend e2e tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run Prisma migrations |

---

## Documentation

### Architecture

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Full architecture documentation covering:
  - [Technology stack](docs/ARCHITECTURE.md#1-technology-stack) and [system diagram](docs/ARCHITECTURE.md#2-system-architecture)
  - [Backend modules](docs/ARCHITECTURE.md#3-backend-architecture), [API route map](docs/ARCHITECTURE.md#32-api-route-map-prefixed-apiv1), and [data model](docs/ARCHITECTURE.md#33-data-model)
  - [13 design patterns](docs/ARCHITECTURE.md#4-design-patterns) (DI, Repository, Strategy, Guard, Interceptor, etc.)
  - [Security architecture](docs/ARCHITECTURE.md#5-security-architecture) (JWT flow, token rotation, Argon2, AES-256-GCM, log redaction)
  - [Frontend architecture](docs/ARCHITECTURE.md#6-frontend-architecture-web) (App Router, state, API client)
  - [Mobile architecture](docs/ARCHITECTURE.md#7-mobile-app-architecture) (navigation, Zustand stores)
  - [Observability](docs/ARCHITECTURE.md#8-observability-architecture) (Pino, correlation, Fluent Bit pipeline)
  - [Infrastructure](docs/ARCHITECTURE.md#9-infrastructure) (containers, CI/CD, Docker log config)

### Security

- **[docs/SECRETS-ENCRYPTION-GUIDE.md](docs/SECRETS-ENCRYPTION-GUIDE.md)** — AES-256-GCM encryption at rest: how to generate the master key, encrypt/decrypt secrets, and manage the seed

### Observability

- **[docs/LTS-INTEGRATION-STEPS.md](docs/LTS-INTEGRATION-STEPS.md)** — Step-by-step Huawei Cloud LTS setup (log group, stream, AK/SK, Fluent Bit agent, verification)
- **[docs/lts-logging-guide.md](docs/lts-logging-guide.md)** — JSON log format reference and Fluent Bit ingest configuration

### Mobile

- **[mobile/README.md](mobile/README.md)** — Expo app setup, environment configuration, and build instructions

---

## Security

This project follows security best practices:

- **No hardcoded secrets** — all keys, passwords, and API credentials are loaded from environment variables. The `.env` file is gitignored.
- **JWT with RS256** — access and refresh tokens signed with RSA keypairs (not symmetric secrets)
- **Argon2 password hashing** — memory-hard, resistant to GPU/ASIC attacks
- **AES-256-GCM encryption at rest** — sensitive card/statement data encrypted with authenticated encryption (see [encryption guide](docs/SECRETS-ENCRYPTION-GUIDE.md))
- **Account lockout** — configurable threshold and duration for brute-force protection
- **Input validation** — NestJS `ValidationPipe` with `forbidNonWhitelisted` rejects unknown fields
- **Log redaction** — Pino redacts passwords, tokens, and auth headers from structured logs
- **CORS** — configurable allowed origins per environment
- **Secure cookies** — `COOKIE_SECURE` flag for HTTPS-only deployments

**Verified:** No environment variables, API keys, or MaaS/Huawei Cloud keys are exposed in the repository. All `.env.example` files use `CHANGE_ME` placeholders. Fluent Bit references LTS credentials via `${LTS_AK}` / `${LTS_SK}` environment variable substitution.

---

## Deployment

### Docker Compose (Production)

```bash
cp .env.production.example .env
# Fill in all CHANGE_ME values with real secrets
docker compose -f docker-compose.prod.yml up -d
```

This starts PostgreSQL, Redis, backend, web, and Fluent Bit with proper log drivers.

### Environments

| Environment | Port | Branch | Network | Purpose |
|-------------|------|--------|---------|---------|
| **UAT** | 80/443 | `master` | `pulseagentarts_default` | User acceptance testing |
| **DEV** | 8080 | `dev` | `pulseagentarts_dev` | Development and feature work |

---

## API Overview

The backend exposes a versioned REST API at `/api/v1` with Swagger documentation at `/api/docs`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login with email/password |
| `POST` | `/auth/refresh` | Refresh access token |
| `GET` | `/circles` | List user's family circles |
| `POST` | `/circles` | Create a new circle |
| `DELETE` | `/circles/:id` | Delete circle (admin only, cascade) |
| `GET` | `/transactions` | List transactions |
| `POST` | `/transactions` | Create expense/income |
| `GET` | `/cards` | List credit cards |
| `POST` | `/cards/statements/upload` | Upload PDF statement |
| `GET` | `/anomalies` | List anomaly alerts |
| `GET` | `/whatsapp/status` | Check WhatsApp connection |
| `POST` | `/whatsapp/connect` | Start WhatsApp connection |

See the [full API route map](docs/ARCHITECTURE.md#32-api-route-map-prefixed-apiv1) in the architecture docs.

---

## Testing

```bash
# Backend unit tests
cd backend && npm test

# Backend e2e tests
cd backend && npm run test:e2e

# Backend coverage
cd backend && npm run test:cov
```

---

## License

Private project. All rights reserved.
