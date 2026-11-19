# PulseAgentArts

> Family Expense Management Platform — full-stack monorepo with web, mobile, backend API, AI financial intelligence, and WhatsApp voice-note ingestion.

Track, manage, and visualize family expenses with multi-currency support, intelligent anomaly detection, WhatsApp text + voice note ingestion, PDF statement parsing, AI-generated dashboards, financial copilot, and monthly payment plan automation.

---

## Features

### Core
- **Family Circles** — create groups, invite members, share expenses with role-based access (admin/member)
- **Multi-Currency** — ARS, USD, EUR with automatic exchange rate conversion
- **Credit Cards & Statements** — upload PDF statements, automatic line-item extraction and categorization
- **Recurring Transactions** — monthly income/expense tracking with pause/resume
- **Anomaly Detection** — flag unusual spending patterns, orphaned transactions, and irregular amounts
- **Dark Mode** — system-aware theme toggle (via `next-themes`)
- **Google OAuth2** — sign in with Google alongside email/password auth
- **i18n** — full Spanish/English locale switching, no hardcoded UI strings

### WhatsApp
- **Text Message Ingestion** — connect WhatsApp groups via Baileys, auto-parse expense messages (`gaste 1500 en super`)
- **Voice Note Ingestion** — transcribe voice notes via Groq Whisper STT, then parse as expenses or copilot questions
- **Group Scoping** — select specific WhatsApp groups for expense ingestion
- **Copilot via WhatsApp** — ask financial questions directly in WhatsApp, get AI-powered analysis responses

### AI Financial Intelligence
- **AI Dashboard** — LLM generates personalized dashboard with dynamic widgets (KPI cards, charts, tables, alerts, insights)
- **Financial Copilot** — async chat assistant for financial questions, with widget-augmented responses
- **12-Month Projection** — income/expense/card payment projections with LLM natural language explanations
- **Payment Strategy Engine** — avalanche, snowball, proportional, and minimum-only strategies with AI reasoning
- **Monthly Payment Plans** — AI-generated payment plans with deviation analysis (planned vs actual)
- **Investment Suggestions** — LLM-powered investment advice based on surplus and current portfolio

### Infrastructure
- **Structured Logging** — Pino JSON logs → Fluent Bit → Huawei Cloud LTS for centralized observability
- **AI Agent** — MCP (Model Context Protocol) server for programmatic expense queries
- **Security** — JWT (RS256), Argon2 password hashing, AES-256-GCM encryption at rest, account lockout, CSP nonces
- **Dual Environment** — isolated DEV and UAT environments on same host

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
| **LLM (Text)** | Huawei Cloud MaaS — GLM-5.2, GLM-5.1, DeepSeek-v4.1-flash |
| **Speech-to-Text** | Groq Whisper — whisper-large-v3-turbo (multilingual) |
| **AI Agent** | Model Context Protocol (MCP) SDK |
| **Reverse Proxy** | Nginx 1.30.7 (HTTP/2, TLS 1.2/1.3) |
| **Container** | Docker (node:22) |
| **CI/CD** | GitHub Actions |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture documentation.

---

## Project Structure

```
PulseAgentArts/
├── backend/              # NestJS API server (port 3000)
│   ├── src/
│   │   ├── auth/         # JWT, Google OAuth, guards
│   │   ├── circle/       # Family groups + invitations
│   │   ├── transaction/  # Expenses + incomes
│   │   ├── card/         # Credit cards (debit/credit)
│   │   ├── statement/    # PDF parsing + reconciliation
│   │   ├── recurring/    # Recurring transactions
│   │   ├── whatsapp/     # WhatsApp integration (text + voice)
│   │   ├── llm/          # Huawei Cloud MaaS orchestrator
│   │   ├── projection/   # 12-month projection + AI dashboard + copilot
│   │   ├── payment-plan/ # Monthly payment plans + deviations
│   │   ├── anomaly/      # Discrepancy detection
│   │   └── common/       # Prisma + Redis + decorators
│   ├── prisma/           # Schema and seed scripts
│   └── keys/             # JWT RSA keypairs (gitignored)
├── web/                  # Next.js frontend (port 3001)
│   └── src/
│       ├── app/          # App Router pages
│       ├── components/   # UI + layout components
│       ├── contexts/     # Auth + Toast contexts
│       └── lib/          # API client + i18n + utilities
├── mobile/               # Expo React Native app
├── mcp-server/           # MCP AI agent server
├── docs/                 # Architecture + integration guides
├── fluent-bit/           # Fluent Bit config for LTS log shipping
├── docker-compose.yml    # Local dev (PostgreSQL + Redis)
├── docker-compose.prod.yml  # Production stack
├── .env.example          # Environment variable template
└── package.json          # Workspace root scripts
```

---

## Prerequisites

- **Node.js** >= 22
- **npm** >= 10
- **Docker** + Docker Compose
- **OpenSSL** (for JWT keys and encryption seeds)
- **ffmpeg** (in backend container, for WhatsApp audio conversion)

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

### Key Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | RSA keypair paths for JWT signing |
| `STATEMENT_PASSWORD_KEY` | AES-256-GCM master key for encrypting sensitive data at rest |
| `HUAWEI_MASS_ENDPOINT` | Huawei Cloud MaaS API URL (LLM text generation) |
| `HUAWEI_MASS_API_KEY` | MaaS API key (Bearer token auth) |
| `GROQ_API_KEY` | Groq API key for speech-to-text (WhatsApp voice notes) |
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
  - Technology stack and system diagram (dual DEV+UAT environment)
  - Backend modules (21 feature modules), API route map, and data model
  - AI/LLM architecture (model routing, dashboard, copilot, payment plan)
  - WhatsApp architecture (text + voice note STT flow)
  - 14 design patterns (DI, Repository, Strategy, Guard, Interceptor, Fallback, etc.)
  - Security architecture (JWT, Argon2, AES-256-GCM, log redaction, API key security)
  - Frontend architecture (App Router, state, API client, i18n)
  - Mobile architecture (navigation, Zustand stores)
  - Observability (Pino, correlation, Fluent Bit pipeline)
  - Infrastructure (containers, nginx, CI/CD)
  - Environment variables reference

### Security

- **[docs/SECRETS-ENCRYPTION-GUIDE.md](docs/SECRETS-ENCRYPTION-GUIDE.md)** — AES-256-GCM encryption at rest

### Observability

- **[docs/LTS-INTEGRATION-STEPS.md](docs/LTS-INTEGRATION-STEPS.md)** — Huawei Cloud LTS setup
- **[docs/lts-logging-guide.md](docs/lts-logging-guide.md)** — JSON log format reference

### Security Audits

- **[docs/PENTEST-REPORT.md](docs/PENTEST-REPORT.md)** — Full pentest report
- **[docs/PENTEST-REPORT-UAT.md](docs/PENTEST-REPORT-UAT.md)** — UAT-specific pentest

### Mobile

- **[mobile/README.md](mobile/README.md)** — Expo app setup and build instructions

---

## Security

This project follows security best practices:

- **No hardcoded secrets** — all keys, passwords, and API credentials are loaded from environment variables. The `.env` file is gitignored.
- **JWT with RS256** — access and refresh tokens signed with RSA keypairs
- **Argon2 password hashing** — memory-hard, resistant to GPU/ASIC attacks
- **AES-256-GCM encryption at rest** — sensitive card/statement data encrypted
- **Account lockout** — configurable threshold and duration for brute-force protection
- **Input validation** — NestJS `ValidationPipe` with `forbidNonWhitelisted`
- **Log redaction** — Pino redacts passwords, tokens, and auth headers
- **CORS** — configurable allowed origins per environment
- **Secure cookies** — `COOKIE_SECURE` flag for HTTPS-only deployments
- **CSP nonces** — per-request Content Security Policy via Next.js middleware
- **Rate limiting** — 2000 req/min throttler with trust proxy

---

## Deployment

### Docker Compose (Production)

```bash
cp .env.production.example .env
# Fill in all CHANGE_ME values with real secrets
docker compose -f docker-compose.prod.yml up -d
```

### Environments

| Environment | Container Suffix | Branch | Domain | Purpose |
|-------------|-----------------|--------|--------|---------|
| **UAT** | `-sec` | `master` | `pulseexpends.duckdns.org` (HTTPS) | User acceptance testing |
| **DEV** | `-dev` | `dev` | `pulseexpends.duckdns.org:8080` (HTTP) | Development + feature work |

Both environments run on the same ECS host (7.1 GB RAM, 4 CPU, 50 GB disk) with isolated Docker networks, volumes, and databases.

---

## API Overview

The backend exposes a versioned REST API at `/api/v1` with Swagger documentation at `/api/docs`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login with email/password |
| `GET` | `/circles` | List user's family circles |
| `POST` | `/circles` | Create a new circle |
| `GET` | `/transactions` | List transactions |
| `POST` | `/transactions` | Create expense/income |
| `GET` | `/cards` | List credit cards |
| `POST` | `/cards/statements/upload` | Upload PDF statement |
| `GET` | `/anomalies` | List anomaly alerts |
| `GET` | `/whatsapp/status` | Check WhatsApp connection |
| `POST` | `/whatsapp/connect` | Start WhatsApp connection |
| `GET` | `/circles/:id/projection` | 12-month financial projection |
| `GET` | `/circles/:id/payment-strategy` | Payment strategy recommendations |
| `GET` | `/circles/:id/ai-dashboard` | AI-generated dashboard layout |
| `POST` | `/circles/:id/copilot` | Ask financial copilot (async) |
| `POST` | `/circles/:id/payment-plans/generate` | Generate monthly payment plan |
| `GET` | `/circles/:id/payment-plans/current` | Get current payment plan |
| `POST` | `/circles/:id/payment-plans/:id/analyze-deviation` | Analyze plan vs actual deviations |

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
