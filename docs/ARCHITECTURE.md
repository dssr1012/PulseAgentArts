# PulseAgentArts — Architecture Documentation

> Family Expense Management Platform — full-stack monorepo with web, mobile, backend API, AI financial intelligence, and WhatsApp voice-note ingestion.

---

## 1. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | NestJS (Node.js) | 10.3 |
| **Frontend (Web)** | Next.js + React | 16.3 / 19 |
| **Frontend (Mobile)** | Expo + React Native | 57.0 / 0.86 |
| **AI Agent** | Model Context Protocol (MCP) | SDK 1.x |
| **Database** | PostgreSQL | 16 |
| **ORM** | Prisma | 5.22 |
| **Cache** | Redis (ioredis) | 7 |
| **Language** | TypeScript | 5.8 |
| **Runtime** | Node.js | 22 |
| **Auth** | JWT (RS256) + Passport + Argon2 | — |
| **Logging** | Pino (structured JSON) | 9.x |
| **Log Shipping** | Fluent Bit → Huawei Cloud LTS | 3.0 |
| **WhatsApp** | Baileys (@whiskeysockets) | 7.0.0-rc14 |
| **Email** | Nodemailer (Resend SMTP) | 7 |
| **PDF Parsing** | pdf-parse | — |
| **LLM (Text)** | Huawei Cloud MaaS (OpenAI-compatible) | — |
| **LLM Models** | GLM-5.2, GLM-5.1, DeepSeek-v4.1-flash | — |
| **Speech-to-Text** | Groq Whisper (OpenAI-compatible) | — |
| **STT Models** | whisper-large-v3-turbo, whisper-large-v3 | — |
| **Container** | Docker (node:22-alpine) | — |
| **CI/CD** | GitHub Actions | — |
| **Reverse Proxy** | Nginx | 1.30.7 |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Huawei Cloud ECS (cn-north-4)                     │
│                    7.1 GB RAM · 4 CPU · 50 GB Disk                    │
│                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │  Mobile App │     │  Web (UAT)  │     │  Web (DEV)  │            │
│  │  (Expo)     │     │  Next.js    │     │  Next.js    │            │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘            │
│         │                   │                   │                    │
│         └───────────────────┼───────────────────┘                    │
│                             │                                          │
│                    ┌────────▼────────┐                                │
│                    │     Nginx       │  443/SSL (UAT) + 80 (DEV)     │
│                    │    1.30.7       │  HTTP/2, reverse proxy        │
│                    └────┬───────┬────┘                                │
│                         │       │                                     │
│           ┌─────────────▼┐  ┌──▼──────────────┐                      │
│           │ Backend (UAT)│  │  Backend (DEV)  │                      │
│           │  NestJS :3000│  │  NestJS :3000   │                      │
│           └──┬──┬──┬──┬──┘  └──┬──┬──┬──┬───┘                      │
│              │  │  │  │        │  │  │  │                            │
│         ┌────┘  │  │  └──┐  ┌──┘  │  │  └──┐                        │
│    ┌────▼──┐ ┌──▼┐ ┌▼────┐ ┌▼──┐ ┌──▼┐ ┌▼────┐                    │
│    │Postgres│ │Red│ │WhatA│ │Post│ │Red│ │WhatA│                    │
│    │ :5432  │ │is  │ │App  │ │gres│ │is  │ │App  │                    │
│    └────────┘ └───┘ └─────┘ └────┘ └───┘ └─────┘                    │
│                                                                       │
│  ┌──────────────┐                                                    │
│  │  Fluent Bit  │──tails docker logs──→ Huawei Cloud LTS             │
│  └──────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
        │                                          │
        │          ┌───────────────────┐           │
        └─────────→│  Huawei Cloud MaaS │←──────────┘
                   │  (LLM Text Gen)    │
                   │  GLM-5.2 / 5.1     │
                   │  DeepSeek-flash    │
                   └───────────────────┘
                              ▲
                              │
          ┌───────────────────┴───────────────────┐
          │         Groq Cloud API (STT)           │
          │  whisper-large-v3-turbo (multilingual) │
          │  POST /openai/v1/audio/transcriptions  │
          └────────────────────────────────────────┘
```

### 2.1 Dual Environment

| Environment | Container Suffix | Branch | Network | Domain | Purpose |
|-------------|-----------------|--------|---------|--------|---------|
| **UAT** | `-sec` | `master` | `pulseagentarts_default` | `pulseexpends.duckdns.org` (HTTPS) | User acceptance testing |
| **DEV** | `-dev` | `dev` | `pulseagentarts_dev` | `pulseexpends.duckdns.org:8080` (HTTP) | Development + feature work |

Both environments share the same ECS host but use isolated Docker networks, volumes, databases, and Redis instances.

---

## 3. Backend Architecture

### 3.1 Module Structure

NestJS modular architecture with 21 feature modules + 3 infrastructure modules:

```
AppModule
├── ConfigModule.forRoot()        # Global config (.env, envFilePath: ['.env', '../.env'])
├── ScheduleModule.forRoot()      # Cron jobs
├── LoggerModule (global)         # Pino structured logging
├── CommonModule (global)         # PrismaService + RedisService
├── AuthModule (global)           # JWT, Google OAuth, guards
├── CircleModule                  # Family groups + invitations
├── TransactionModule             # Expenses + incomes
├── CategoryModule                # Expense categories
├── CardModule                    # Credit cards (debit/credit modes)
├── StatementModule               # PDF statement parsing + reconciliation
├── AnomalyModule                 # Discrepancy detection
├── PrivacyModule                 # Private transaction hiding
├── ExchangeModule                # Currency rates (cron)
├── NotificationModule            # Push notifications
├── RegexDictModule               # Notification pattern matching
├── AuditModule                   # Audit trail
├── RecurringModule               # Recurring transactions (income/expense)
├── WhatsappModule                # WhatsApp integration (text + voice notes)
├── LlmModule                     # Huawei Cloud MaaS orchestrator
├── ProjectionModule              # 12-month projection + AI dashboard + copilot
└── PaymentPlanModule             # Monthly payment plans + deviation analysis
```

### 3.2 API Route Map (prefixed `/api/v1`)

| Module | Routes | Guards |
|--------|--------|--------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/google`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/change-password` | Public / JwtAuthGuard |
| Circle | `POST /circles`, `GET /circles`, `GET /circles/:id`, `GET /circles/:id/balance`, `POST /circles/:id/invitations`, `DELETE /circles/:id/members/:userId`, `DELETE /circles/:id` | JwtAuthGuard (+ admin for delete) |
| Invitation | `GET /invitations/:token`, `POST /invitations/:token/accept` | Public / JwtAuthGuard |
| Transaction | `POST /expenses`, `GET /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id`, `POST /expenses/:id/confirm`, `POST /expenses/:id/discard` | JwtAuthGuard + CircleMembershipGuard |
| Income | `POST /incomes`, `GET /incomes` | JwtAuthGuard + CircleMembershipGuard |
| Recurring | `POST /recurring-transactions`, `GET /recurring-transactions`, `PATCH /recurring-transactions/:id`, `DELETE /recurring-transactions/:id`, `POST /recurring-transactions/:id/pause`, `POST /recurring-transactions/:id/resume` | JwtAuthGuard + CircleMembershipGuard |
| Card | `POST /cards`, `GET /cards`, `DELETE /cards/:id`, `POST /cards/:cardId/statements` | SensitiveDataGuard |
| Anomaly | `GET /expenses/irregular`, `POST /expenses/:id/associate`, `POST /expenses/:id/discard` | JwtAuthGuard |
| WhatsApp | `GET /whatsapp/status`, `POST /whatsapp/connect`, `DELETE /whatsapp/disconnect`, `GET /whatsapp/groups`, `POST /whatsapp/expense-groups` | JwtAuthGuard |
| **Projection** | `GET /circles/:id/projection`, `GET /circles/:id/payment-strategy`, `GET /circles/:id/investment-suggestions`, `GET /circles/:id/ai-dashboard`, `POST /circles/:id/copilot`, `GET /circles/:id/copilot/result/:jobId`, `GET /circles/:id/projection-snapshot/:month` | JwtAuthGuard + CircleMembershipGuard |
| **Payment Plan** | `POST /circles/:id/payment-plans/generate`, `GET /circles/:id/payment-plans/current`, `GET /circles/:id/payment-plans`, `GET /circles/:id/payment-plans/:planId`, `PATCH /circles/:id/payment-plans/:planId/items/:itemId`, `POST /circles/:id/payment-plans/:planId/items/:itemId/mark-paid`, `POST /circles/:id/payment-plans/:planId/archive`, `GET /circles/:id/available-cash-suggestion`, `GET /circles/:id/payment-recommendation`, `POST /circles/:id/payment-plans/:planId/analyze-deviation` | JwtAuthGuard + CircleMembershipGuard |

### 3.3 Data Model

```
User ──┬── (N) FamilyGroupMember ── (1) FamilyGroup
       ├── (N) RefreshToken
       ├── (N) WhatsappGroup
       └── (N) Transaction

FamilyGroup ──┬── (N) Invitation
              ├── (N) Transaction
              ├── (N) Category
              ├── (N) CreditCard
              ├── (N) AnomalyAlert
              ├── (N) RecurringTransaction
              ├── (N) PaymentPlan
              └── (N) ProjectionSnapshot

CreditCard ──── (N) CardStatement ──── (N) StatementItem
                                                    │
StatementItem ── (1?) Transaction (matchedTransaction)
Transaction ──── (N) AnomalyAlert
RecurringTransaction ── (1?) CreditCard (cardId)

PaymentPlan ──┬── (1) FamilyGroup (groupId)
              ├── (1) User (generatedBy)
              └── (N) PaymentPlanItem

PaymentPlanItem ─── (1) PaymentPlan (planId)

ProjectionSnapshot ──┬── (1) FamilyGroup (groupId)
                      └── (1) User (generatedBy)
```

**Key models:** User, FamilyGroup, Transaction, CreditCard, CardStatement, StatementItem, AnomalyAlert, Invitation, RefreshToken, Category, ExchangeRate, NotificationPattern, WhatsappGroup, RecurringTransaction, PaymentPlan, PaymentPlanItem, ProjectionSnapshot

---

## 4. AI/LLM Architecture

### 4.1 LLM Orchestrator (Huawei Cloud MaaS)

The `LlmModule` provides a centralized LLM abstraction over Huawei Cloud ModelArts MaaS (OpenAI-compatible API).

```
LlmModule
├── HuaweiCloudLlmService     # Low-level API client (fetch → MaaS)
├── LlmOrchestratorService     # Task routing + business logic
└── MODEL_ROUTING              # Task → model config mapping
```

**Endpoint**: `https://api-ap-southeast-1.modelarts-maas.com/openai/v1/chat/completions`
**Auth**: `Authorization: Bearer {HUAWEI_MASS_API_KEY}`

### 4.2 Model Routing

Tasks are routed to models based on complexity and latency requirements:

| Task | Model | Max Tokens | Temp | Latency | Use Case |
|------|-------|------------|------|---------|----------|
| `expense_parsing_simple` | deepseek-v4.1-flash-1017 | 500 | 0.1 | ~2s | Parse "gasté 5000 en super" |
| `expense_parsing_complex` | glm-5.1 | 1000 | 0.1 | ~5s | Ambiguous messages, multiple items |
| `dashboard_design` | deepseek-v4.1-flash-1017 | 4000 | 0.3 | ~10s | AI dashboard widget layout |
| `payment_recommendation` | glm-5.2 | 3000 | 0.3 | ~55s | Payment plan strategy + JSON |
| `projection_explanation` | glm-5.2 | 2000 | 0.3 | ~55s | Natural language projection summary |
| `payment_strategy` | glm-5.2 | 2000 | 0.3 | ~55s | Payment strategy explanation |
| `investment_advice` | glm-5.2 | 2000 | 0.4 | ~55s | Investment suggestions |
| `deviation_analysis` | glm-5.2 | 2000 | 0.4 | ~55s | Financial deviation analysis |
| `general_chat` | glm-5.1 | 1000 | 0.5 | ~5s | Copilot general questions |

### 4.3 AI Dashboard

The `AiDashboardService` generates personalized dashboard layouts using LLM:

```
User requests /ai-dashboard
  → Check Redis cache (key: ai-dashboard:{circleId}, TTL: 30 days)
  → Cache miss: gather financial data (projection + strategy + cards + transactions)
  → Send compact financial data to LLM (deepseek-v4.1-flash)
  → LLM returns DashboardSpec JSON (title, insights, widgets[])
  → Cache in Redis
  → Return to frontend for dynamic rendering
```

**Widget types**: kpi_cards, area_chart, bar_chart, pie_chart, line_chart, text_block, table, alert

### 4.4 Copilot

The `CopilotService` provides async financial Q&A:

```
POST /copilot { question }
  → Generate jobId, store { status: pending } in Redis (TTL: 5 min)
  → Background: gather financial data → LLM (deepseek-v4.1-flash) → parse JSON response
  → Store { status: done, text, widgets } in Redis
  → Client polls GET /copilot/result/:jobId
```

### 4.5 Payment Plan

The `PaymentPlanModule` automates the user's monthly Excel workflow:

```
POST /payment-plans/generate
  → Get 12-month projection (ProjectionService)
  → Get payment strategy (PaymentStrategyService: avalanche/snowball/proportional/min-only)
  → LLM generates payment recommendation (glm-5.2)
  → Persist PaymentPlan + PaymentPlanItems to DB
  → Return plan with AI reasoning

POST /payment-plans/:planId/analyze-deviation
  → Compare planned vs actual transactions for the month
  → LLM analyzes deviations (glm-5.2)
  → Return deviation report with AI explanation
```

---

## 5. WhatsApp Architecture

### 5.1 Text Message Flow

```
WhatsApp Group Message
  │
  ├── Is it from a selected expense group? (WhatsappGroup table)
  │   └── No → ignore
  │
  ├── Regex parser tries to extract expense
  │   ├── Success → create Transaction (pending_confirmation)
  │   └── Fail → LLM fallback (LlmOrchestrator.parseExpenseMessage)
  │       ├── Success → create Transaction (pending_confirmation)
  │       └── Fail → log + ignore
  │
  └── Copilot detection (isAnalysisRequest)
      └── Yes → CopilotService.askWhatsApp → LLM → reply via WhatsApp
```

### 5.2 Voice Note Flow (STT via Groq)

```
WhatsApp Voice Note (audio message)
  │
  ├── Download audio media (Baileys downloadMediaMessage)
  ├── Convert ogg/opus → mp3 (ffmpeg)
  ├── Send to Groq STT API:
  │   POST https://api.groq.com/openai/v1/audio/transcriptions
  │   { file: audio.mp3, model: "whisper-large-v3-turbo", language: "es" }
  ├── Receive transcription text
  │
  └── Same flow as text message:
      ├── Regex parser → expense
      ├── LLM fallback → expense
      └── Copilot detection → financial analysis reply
```

**Groq STT Configuration:**
- **Model**: `whisper-large-v3-turbo` ($0.04/hour audio, 216x real-time, multilingual)
- **Max file size**: 25 MB (free tier) / 100 MB (dev tier)
- **Formats**: mp3, wav, ogg, m4a, webm, flac, mp4
- **Language**: `es` (Spanish, auto-detected if not specified)
- **Response**: `{ text: "transcribed text" }` or `verbose_json` with timestamps

**Why Groq for STT**: OpenAI-compatible API, 216x real-time speed (a 15-second voice note transcribes in ~0.07s), $0.04/hour pricing, excellent Spanish support via Whisper.

---

## 6. Design Patterns

### 6.1 Module Pattern
Every feature is a self-contained NestJS module with controller + service + DTO. `@Global()` modules (Common, Auth, Logger) provide cross-cutting services.

### 6.2 Dependency Injection
Constructor-based DI throughout. Services declare dependencies in `constructor(private prisma: PrismaService, ...)` and NestJS resolves the graph.

### 6.3 Repository Pattern (Prisma)
`PrismaService` extends `PrismaClient` with lifecycle hooks. All services use `this.prisma.<model>.*` directly — Prisma acts as the generated repository layer.

### 6.4 Strategy Pattern
- **JwtStrategy**: RS256 (public key file) or HS256 (secret) based on config
- **GoogleStrategy**: OAuth2 with email+profile scope, auto-provisions users
- **IStatementParser**: Interface for PDF parsing, `PdfStatementParser` implements it
- **PaymentStrategy**: Avalanche, Snowball, Proportional, Minimum-only strategies

### 6.5 Guard Pattern
| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Verifies JWT, respects `@IsPublic()` |
| `CircleMembershipGuard` | Validates circle membership via `X-Circle-Id` header or JWT claim, enriches `request.user` |
| `RolesGuard` | Role-based access via `@SetRoles('admin')` |
| `SensitiveDataGuard` | Rejects PAN/CVV/card numbers in request body |

### 6.6 Interceptor Pattern
- **TransformInterceptor**: Wraps all responses in `{ success, data, timestamp }` envelope
- **LoggingInterceptor**: Logs request duration + correlation context; captures errors with stack traces

### 6.7 Filter Pattern
- **AllExceptionsFilter**: Global exception handler → standardized `{ statusCode, errorCode, message[], traceId, timestamp }`

### 6.8 Middleware Pattern
- **CorrelationMiddleware**: Injects `trace_id`/`span_id`/`req_id` via `AsyncLocalStorage` for request-scoped correlation

### 6.9 Decorator Pattern
- `@CurrentUser(field?)` — extracts user/field from request
- `@CircleId` — extracts active circle ID
- `@SetRoles(...roles)` — role metadata for `RolesGuard`
- `@IsPublic()` — marks routes as public

### 6.10 DTO/Validator Pattern
DTOs use `class-validator` + `class-transformer` with a global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).

### 6.11 Observer Pattern (WhatsApp)
Baileys' event emitter: `sock.ev.on('messages.upsert', ...)` for incoming messages (text + audio), `connection.update` for QR/connect/disconnect.

### 6.12 Scheduled Task Pattern
`@Cron('0 0 * * *')` in `ExchangeService` fetches daily currency rates.

### 6.13 Factory Pattern
`JwtModule.registerAsync({ useFactory })` dynamically selects RS256 vs HS256. `GoogleStrategy` conditionally registered based on env vars.

### 6.14 Fallback Pattern (LLM)
All LLM-dependent services implement graceful degradation: if `HuaweiCloudLlmService.isAvailable()` returns `false`, services return deterministic fallback responses (static dashboard, raw JSON, generic messages) instead of crashing.

---

## 7. Security Architecture

### 7.1 Authentication Flow
```
Client ──login──→ Backend ──Argon2 verify──→ DB
                   │                          │
                   ├──JWT RS256 sign──→ Access Token (24h TTL)
                   ├──Opaque token──→ Refresh Token (7d TTL, HttpOnly cookie)
                   └──Redis cache──→ Session data
```

### 7.2 Token Rotation
- Access token: in-memory only (XSS-safe), 24-hour TTL
- Refresh token: 32 random bytes, SHA-256 hashed in DB, HttpOnly cookie with `SameSite=Lax`, `Path=/api/v1/auth`
- Rotation on every refresh (old token revoked, new pair issued)

### 7.3 Password Security
- **Hashing**: Argon2id (timeCost=3, memoryCost=64MB, parallelism=4)
- **Lockout**: 5 failed attempts → 30-minute lock (HTTP 423)
- **Reset**: Temp password via email, `mustChangePassword` flag

### 7.4 Encryption at Rest
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Usage**: Credit card statement PDF passwords
- **Format**: `base64(iv):base64(authTag):base64(ciphertext)`

### 7.5 Sensitive Data Rejection
`SensitiveDataGuard` blocks PANs (13-19 digit patterns), CVV, card numbers in request bodies. Only last 4 digits accepted.

### 7.6 Pino Log Redaction
Sensitive fields auto-redacted in logs: `password`, `token`, `authorization`, `cookie`, `apiKey`.

### 7.7 API Key Security
- `HUAWEI_MASS_API_KEY` and `GROQ_API_KEY` stored in `.env` (gitignored), loaded via `ConfigService`
- Never logged, never returned in API responses
- `.env` file is gitignored; `.env.example` files use `CHANGE_ME` placeholders

---

## 8. Frontend Architecture (Web)

### 8.1 Next.js App Router
```
web/src/app/
├── layout.tsx                    # Root layout
├── page.tsx                      # Root (redirects)
├── login/page.tsx                # Login
├── register/page.tsx             # Registration
├── invitations/[token]/page.tsx  # Invitation acceptance
├── auth/google/callback/         # Google OAuth callback
└── (authenticated)/              # Protected route group
    ├── layout.tsx                # Auth guard (redirects to /login)
    ├── dashboard/page.tsx        # Main dashboard
    ├── transactions/page.tsx     # Expense list + management
    ├── incomes/page.tsx          # Income list
    ├── cards/page.tsx            # Credit cards + statements
    ├── categories/page.tsx       # Category management
    ├── circle/page.tsx           # Circle settings + members
    ├── anomalies/page.tsx        # Anomaly alerts
    ├── recurring/page.tsx        # Recurring transactions
    ├── payment-plan/page.tsx     # Monthly payment plan + deviations
    ├── settings/page.tsx         # User settings (WhatsApp, dark mode)
    └── copilot/                  # AI copilot chat (in AppShell)
```

### 8.2 State Management
- **AuthContext**: User state, active circle, session restore, idle timeout (20 min), proactive token refresh
- **ToastContext**: Notification queue with auto-dismiss
- **API Client (singleton)**: In-memory token, axios interceptors, snake_case ↔ camelCase conversion

### 8.3 API Client Flow
```
Request → inject Bearer + X-Circle-Id + X-Correlation-ID
       → convert snake_case body to camelCase
       → send to backend
       → unwrap { success, data, timestamp } envelope
       → convert camelCase response to snake_case
       → on 401: auto-refresh token (deduplicated), retry
```

### 8.4 i18n
Custom i18n system with ES/EN locale switching. All pages use `t()` calls — no hardcoded UI strings. Zero language mixing per page.

---

## 9. Mobile App Architecture

### 9.1 Navigation
```
AppNavigator
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   └── RegisterScreen
└── RootStack (authenticated)
    ├── MainTabs (bottom tabs)
    │   ├── Dashboard (Inicio)
    │   ├── Add (QuickEntry modal)
    │   ├── Transactions (Gastos)
    │   ├── Cards (Tarjetas)
    │   └── Profile (Perfil)
    ├── TransactionDetail
    ├── StatementUpload / StatementPreview
    ├── NotificationSettings
    └── Circle
```

### 9.2 State Management (Zustand)
- `useAuthStore`: Auth state, tokens via `expo-secure-store`
- `useTransactionStore`: Transaction list
- `useNotificationStore`: Notification state

---

## 10. Observability Architecture

### 10.1 Structured Logging (Pino)
```json
{
  "level": 30,
  "time": "2026-11-20T14:15:48.813Z",
  "service_name": "pulse-backend",
  "service_version": "1.0.0",
  "environment": "production",
  "trace_id": "abc-123",
  "span_id": "def456",
  "req_id": "ghi789",
  "context": "HuaweiCloudLlmService",
  "event": "http_request",
  "msg": "LLM call: model=glm-5.2, tokens=13560, latency=68162ms"
}
```

### 10.2 Correlation Context
`AsyncLocalStorage` propagates `trace_id`/`span_id`/`req_id` through the entire request lifecycle — every log line within a request automatically includes the correlation IDs.

### 10.3 Log Collection Pipeline
```
Pino (JSON → stdout)
  → Docker json-file driver (rotation: 50m × 5 files)
    → Fluent Bit (tail + JSON parse)
      → Huawei Cloud LTS (structured search + dashboards + alerts)
```

---

## 11. Infrastructure

### 11.1 Container Architecture (UAT)

| Container | Image | Port | Memory Limit | Purpose |
|-----------|-------|------|-------------|---------|
| `pulse-backend-sec` | node:22-slim | 3000 (host) | 1 GB | NestJS backend (UAT) |
| `pulse-web-sec` | node:22-slim | 3001 (127.0.0.1) | 2 GB | Next.js web (UAT) |
| `pulseexpends-postgres-sec` | postgres:16-alpine | 5432 (127.0.0.1) | 512 MB | Database (UAT) |
| `pulseexpends-redis-sec` | redis:7-alpine | 6379 (127.0.0.1) | 256 MB | Cache (UAT) |

### 11.2 Container Architecture (DEV)

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `pulse-backend-dev` | node:22-slim | 3000 (host) | NestJS backend (DEV) |
| `pulse-web-dev` | node:22-slim | 3001 (host) | Next.js web (DEV) |
| `pulseexpends-postgres-dev` | postgres:16-alpine | 5432 (host) | Database (DEV) |
| `pulseexpends-redis-dev` | redis:7-alpine | 6379 (host) | Cache (DEV) |
| `pulse-mcp-dev` | node:22-slim | 3002 (host) | MCP AI agent server |
| `pulse-nginx-api-dev` | nginx | 8080 (host) | DEV API reverse proxy |
| `pulse-nginx-mcp-dev` | nginx | — | DEV MCP reverse proxy |

### 11.3 Nginx Configuration

- **Version**: 1.30.7 (nginx.org repo, jammy)
- **HTTP/2**: Enabled globally (`http2 on;`)
- **SSL**: TLSv1.2 + TLSv1.3, Let's Encrypt certs
- **Proxy timeout**: 120s for `/api/` (LLM calls can take 55-68s)
- **Security headers**: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **CSP**: Per-request nonces via Next.js middleware
- **Rate limiting**: Throttler 2000 req/min

### 11.4 CI/CD Pipeline (GitHub Actions)
4 parallel jobs on push/PR: backend (lint+test+build), web (lint+build), mobile (lint+typecheck), mcp-server (build). All use Node 22.

---

## 12. Cross-Platform Data Flow

```
[Mobile App]  ──axios──→ [Backend :3000]
[Web App]     ──nginx──→ [Backend :3000]
[MCP Server]  ──fetch──→ [Backend :3000]
[WhatsApp]    ──Baileys──→ [Backend :3000]
                            │
                      ├── PostgreSQL (Prisma)
                      ├── Redis (sessions, cache, AI dashboard, copilot jobs)
                      ├── WhatsApp (Baileys)
                      ├── SMTP (Resend)
                      ├── Huawei Cloud MaaS (LLM text generation)
                      └── Groq API (STT voice transcription)

[Fluent Bit] ──docker logs──→ [Huawei LTS]
```

**Case convention**: Backend = camelCase, Frontend = snake_case. API client auto-converts.

**Multi-circle**: Active circle passed via `X-Circle-Id` header. `CircleMembershipGuard` validates DB membership.

**Response envelope**: All API responses wrapped in `{ success: boolean, data: T, timestamp: string }`.

---

## 13. Environment Variables Reference

### Core

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | RSA keypair paths | Yes |
| `STATEMENT_PASSWORD_KEY` | AES-256-GCM master key | Yes |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection | Yes |

### AI/LLM

| Variable | Description | Required |
|----------|-------------|----------|
| `HUAWEI_MASS_ENDPOINT` | Huawei Cloud MaaS API URL | For AI features |
| `HUAWEI_MASS_API_KEY` | MaaS API key (Bearer token) | For AI features |
| `GROQ_API_KEY` | Groq API key for STT | For voice notes |
| `GROQ_STT_MODEL` | Whisper model (default: `whisper-large-v3-turbo`) | No |

### External Services

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth2 | No |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email service | No |
| `FX_API_URL` / `FX_API_KEY` | Exchange rate API | Yes |
| `LTS_AK` / `LTS_SK` / `LTS_GROUP_ID` / `LTS_STREAM_ID` | Huawei Cloud LTS | For log shipping |
