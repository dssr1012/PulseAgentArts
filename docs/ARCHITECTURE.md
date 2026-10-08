# PulseAgentArts — Architecture Documentation

> Family Expense Management Platform — full-stack monorepo with web, mobile, backend API, and AI agent integration.

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
| **Container** | Docker (node:22-alpine) | — |
| **CI/CD** | GitHub Actions | — |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Huawei Cloud (cn-north-4)                 │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │ Mobile   │   │  Web     │   │ MCP      │                │
│  │ (Expo)   │   │ (Next.js)│   │ Server   │                │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                │
│       │               │              │                       │
│       └───────────────┼──────────────┘                      │
│                       │                                      │
│                  ┌────▼─────┐                                │
│                  │  Nginx   │ (port 80, reverse proxy)      │
│                  └────┬─────┘                                │
│                       │                                      │
│              ┌────────▼────────┐                            │
│              │  NestJS Backend  │ (port 3000)               │
│              │  (Docker, host   │                            │
│              │   network)       │                            │
│              └──┬─────┬────┬───┘                            │
│                 │     │    │                                  │
│          ┌──────▼┐ ┌─▼──┐ ┌▼────────┐                      │
│          │Postgres│ │Redis│ │WhatsApp │                      │
│          │  :5432 │ │:6379│ │(Baileys)│                      │
│          └────────┘ └────┘ └─────────┘                      │
│                                                              │
│  ┌──────────┐                                               │
│  │Fluent Bit│──tails docker logs──→ Huawei Cloud LTS        │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Module Structure

NestJS modular architecture with 14 feature modules + 3 infrastructure modules:

```
AppModule
├── ConfigModule.forRoot()     # Global config (.env)
├── ScheduleModule.forRoot()   # Cron jobs
├── LoggerModule (global)      # Pino structured logging
├── CommonModule (global)      # PrismaService + RedisService
├── AuthModule (global)        # JWT, Google OAuth, guards
├── CircleModule               # Family groups + invitations
├── TransactionModule          # Expenses + incomes
├── CategoryModule             # Expense categories
├── CardModule                 # Credit cards
├── StatementModule            # PDF statement parsing
├── AnomalyModule              # Discrepancy detection
├── PrivacyModule              # Private transaction hiding
├── ExchangeModule             # Currency rates (cron)
├── NotificationModule         # Push notifications
├── RegexDictModule            # Notification pattern matching
├── AuditModule                # Audit trail
└── WhatsappModule             # WhatsApp integration
```

### 3.2 API Route Map (prefixed `/api/v1`)

| Module | Routes | Guards |
|--------|--------|--------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/google`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/change-password` | Public / JwtAuthGuard |
| Circle | `POST /circles`, `GET /circles`, `GET /circles/:id`, `GET /circles/:id/balance`, `POST /circles/:id/invitations`, `DELETE /circles/:id/members/:userId` | JwtAuthGuard |
| Invitation | `GET /invitations/:token`, `POST /invitations/:token/accept` | Public / JwtAuthGuard |
| Transaction | `POST /expenses`, `GET /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id`, `POST /expenses/:id/confirm`, `POST /expenses/:id/discard` | JwtAuthGuard + CircleMembershipGuard |
| Income | `POST /incomes`, `GET /incomes` | JwtAuthGuard + CircleMembershipGuard |
| Card | `POST /cards`, `GET /cards`, `DELETE /cards/:id`, `POST /cards/:cardId/statements` | SensitiveDataGuard |
| Anomaly | `GET /expenses/irregular`, `POST /expenses/:id/associate`, `POST /expenses/:id/discard` | JwtAuthGuard |
| WhatsApp | `GET /whatsapp/status`, `POST /whatsapp/connect`, `DELETE /whatsapp/disconnect`, `GET /whatsapp/groups`, `POST /whatsapp/expense-groups` | JwtAuthGuard |

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
              └── (N) AnomalyAlert

CreditCard ──── (N) CardStatement ──── (N) StatementItem
                                                    │
StatementItem ── (1?) Transaction (matchedTransaction)
Transaction ──── (N) AnomalyAlert
```

**Key models:** User, FamilyGroup, Transaction, CreditCard, CardStatement, StatementItem, AnomalyAlert, Invitation, RefreshToken, Category, ExchangeRate, NotificationPattern, WhatsappGroup

---

## 4. Design Patterns

### 4.1 Module Pattern
Every feature is a self-contained NestJS module with controller + service + DTO. `@Global()` modules (Common, Auth, Logger) provide cross-cutting services.

### 4.2 Dependency Injection
Constructor-based DI throughout. Services declare dependencies in `constructor(private prisma: PrismaService, ...)` and NestJS resolves the graph.

### 4.3 Repository Pattern (Prisma)
`PrismaService` extends `PrismaClient` with lifecycle hooks. All services use `this.prisma.<model>.*` directly — Prisma acts as the generated repository layer.

### 4.4 Strategy Pattern
- **JwtStrategy**: RS256 (public key file) or HS256 (secret) based on config
- **GoogleStrategy**: OAuth2 with email+profile scope, auto-provisions users
- **IStatementParser**: Interface for PDF parsing, `PdfStatementParser` implements it

### 4.5 Guard Pattern
| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Verifies JWT, respects `@IsPublic()` |
| `CircleMembershipGuard` | Validates circle membership, enriches `request.user` |
| `RolesGuard` | Role-based access via `@SetRoles('admin')` |
| `SensitiveDataGuard` | Rejects PAN/CVV/card numbers in request body |

### 4.6 Interceptor Pattern
- **TransformInterceptor**: Wraps all responses in `{ success, data, timestamp }` envelope
- **LoggingInterceptor**: Logs request duration + correlation context; captures errors with stack traces

### 4.7 Filter Pattern
- **AllExceptionsFilter**: Global exception handler → standardized `{ statusCode, errorCode, message[], traceId, timestamp }`

### 4.8 Middleware Pattern
- **CorrelationMiddleware**: Injects `trace_id`/`span_id`/`req_id` via `AsyncLocalStorage` for request-scoped correlation

### 4.9 Decorator Pattern
- `@CurrentUser(field?)` — extracts user/field from request
- `@CircleId` — extracts active circle ID
- `@SetRoles(...roles)` — role metadata for `RolesGuard`
- `@IsPublic()` — marks routes as public

### 4.10 DTO/Validator Pattern
DTOs use `class-validator` + `class-transformer` with a global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).

### 4.11 Observer Pattern (WhatsApp)
Baileys' event emitter: `sock.ev.on('messages.upsert', ...)` for incoming messages, `connection.update` for QR/connect/disconnect.

### 4.12 Scheduled Task Pattern
`@Cron('0 0 * * *')` in `ExchangeService` fetches daily currency rates.

### 4.13 Factory Pattern
`JwtModule.registerAsync({ useFactory })` dynamically selects RS256 vs HS256. `GoogleStrategy` conditionally registered based on env vars.

---

## 5. Security Architecture

### 5.1 Authentication Flow
```
Client ──login──→ Backend ──Argon2 verify──→ DB
                   │                          │
                   ├──JWT RS256 sign──→ Access Token (5 min TTL)
                   ├──Opaque token──→ Refresh Token (20 min TTL, HttpOnly cookie)
                   └──Redis cache──→ Session data
```

### 5.2 Token Rotation
- Access token: in-memory only (XSS-safe), 5-minute TTL
- Refresh token: 32 random bytes, SHA-256 hashed in DB, HttpOnly cookie with `SameSite=Lax`, `Path=/api/v1/auth`
- Rotation on every refresh (old token revoked, new pair issued)

### 5.3 Password Security
- **Hashing**: Argon2id (timeCost=3, memoryCost=64MB, parallelism=4)
- **Lockout**: 5 failed attempts → 30-minute lock (HTTP 423)
- **Reset**: Temp password via email, `mustChangePassword` flag

### 5.4 Encryption at Rest
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Usage**: Credit card statement PDF passwords
- **Format**: `base64(iv):base64(authTag):base64(ciphertext)`

### 5.5 Sensitive Data Rejection
`SensitiveDataGuard` blocks PANs (13-19 digit patterns), CVV, card numbers in request bodies. Only last 4 digits accepted.

### 5.6 Pino Log Redaction
Sensitive fields auto-redacted in logs: `password`, `token`, `authorization`, `cookie`, `apiKey`.

---

## 6. Frontend Architecture (Web)

### 6.1 Next.js App Router
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
    ├── dashboard/page.tsx
    ├── transactions/page.tsx
    ├── incomes/page.tsx
    ├── cards/page.tsx
    ├── categories/page.tsx
    ├── circle/page.tsx
    ├── anomalies/page.tsx
    └── settings/page.tsx
```

### 6.2 State Management
- **AuthContext**: User state, active circle, session restore, idle timeout (20 min), proactive token refresh
- **ToastContext**: Notification queue with auto-dismiss
- **API Client (singleton)**: In-memory token, axios interceptors, snake_case ↔ camelCase conversion

### 6.3 API Client Flow
```
Request → inject Bearer + X-Circle-Id + X-Correlation-ID
       → convert snake_case body to camelCase
       → send to backend
       → unwrap { success, data, timestamp } envelope
       → convert camelCase response to snake_case
       → on 401: auto-refresh token (deduplicated), retry
```

---

## 7. Mobile App Architecture

### 7.1 Navigation
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

### 7.2 State Management (Zustand)
- `useAuthStore`: Auth state, tokens via `expo-secure-store`
- `useTransactionStore`: Transaction list
- `useNotificationStore`: Notification state

### 7.3 Key Services
- `notificationListener.ts`: Android notification listener for expense capture from banking apps
- `regexEngine.ts`: Regex dictionary sync + notification parsing
- `duplicateDetector.ts`: Duplicate expense detection
- `googleSignIn.ts`: Google Sign-In integration

---

## 8. Observability Architecture

### 8.1 Structured Logging (Pino)
```json
{
  "level": 30,
  "time": "2026-10-08T14:15:48.813Z",
  "service_name": "pulse-backend",
  "service_version": "1.0.0",
  "environment": "production",
  "trace_id": "abc-123",
  "span_id": "def456",
  "req_id": "ghi789",
  "context": "AuthService",
  "event": "http_request",
  "msg": "POST /api/v1/auth/login 151ms"
}
```

### 8.2 Correlation Context
`AsyncLocalStorage` propagates `trace_id`/`span_id`/`req_id` through the entire request lifecycle — every log line within a request automatically includes the correlation IDs.

### 8.3 Log Collection Pipeline
```
Pino (JSON → stdout)
  → Docker json-file driver (rotation: 50m × 5 files)
    → Fluent Bit (tail + JSON parse)
      → Huawei Cloud LTS (structured search + dashboards + alerts)
```

### 8.4 Error Handling
- `uncaughtException` / `unhandledRejection` → `logger.fatal()` + `process.exit(1)`
- `AllExceptionsFilter` → structured error log with stack trace + correlation context
- `LoggingInterceptor` → HTTP error log with duration + error object

---

## 9. Infrastructure

### 9.1 Container Architecture
| Container | Image | Port | Network |
|-----------|-------|------|---------|
| `pulse-backend-new` | node:22-slim | 3000 | host |
| `pulseexpends-web` | node:22-slim | 3001 | bridge |
| `pulseexpends-postgres` | postgres:16-alpine | 5432 | bridge (172.20.0.2) |
| `pulseexpends-redis` | redis:7-alpine | 6379 | bridge (172.20.0.3) |
| `fluent-bit` | fluent/fluent-bit:3.0 | — | bridge |

### 9.2 CI/CD Pipeline (GitHub Actions)
4 parallel jobs on push/PR: backend (lint+test+build), web (lint+build), mobile (lint+typecheck), mcp-server (build). All use Node 22.

### 9.3 Docker Log Configuration
```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"
```

---

## 10. Cross-Platform Data Flow

```
[Mobile App] ──axios──→ [Backend :3000]
[Web App]    ──nginx──→ [Backend :3000]
[MCP Server] ──fetch──→ [Backend :3000]
                           │
                     ├── PostgreSQL (Prisma)
                     ├── Redis (sessions, cache)
                     ├── WhatsApp (Baileys)
                     └── SMTP (Resend)

[Fluent Bit] ──docker logs──→ [Huawei LTS]
```

**Case convention**: Backend = camelCase, Frontend = snake_case. API client auto-converts.

**Multi-circle**: Active circle passed via `X-Circle-Id` header. `CircleMembershipGuard` validates DB membership.

**Response envelope**: All API responses wrapped in `{ success: boolean, data: T, timestamp: string }`.
