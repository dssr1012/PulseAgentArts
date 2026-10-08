# Huawei Cloud LTS — Integration Step-by-Step

> **Goal:** Send structured JSON logs from the PulseAgentArts backend (pino → Docker stdout) to Huawei Cloud Log Tank Service (LTS) for centralized search, dashboards, and alerting.

---

## Phase 1: Backend Verification (Already Done)

The backend already emits structured JSON logs via `pino` to `process.stdout`. Verify:

```bash
docker logs pulse-backend-new 2>&1 | head -5
```

You should see lines like:
```json
{"level":30,"time":"2026-10-08T14:15:48.813Z","service_name":"pulse-backend","service_version":"1.0.0","environment":"production","event":"redis_connected","msg":"Redis connected"}
```

**Key fields in every log line:**
| Field | Example | Description |
|-------|---------|-------------|
| `level` | `30` | Pino numeric: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal |
| `time` | `2026-10-08T14:15:48.813Z` | ISO-8601 UTC timestamp |
| `service_name` | `pulse-backend` | Service identifier |
| `service_version` | `1.0.0` | App version |
| `environment` | `production` | Deployment environment |
| `trace_id` | `abc-123` | Correlation trace ID (from `x-trace-id` header or generated) |
| `span_id` | `def456` | Span ID for request tracing |
| `req_id` | `ghi789` | Request ID (from `x-request-id` header or generated) |
| `context` | `AuthService` | NestJS logger context (class name) |
| `event` | `http_request` | Event type tag |
| `msg` | `POST /login 151ms` | Human-readable message |
| `err.type` | `TypeError` | Error class name (when applicable) |
| `err.message` | `...` | Error message (when applicable) |
| `err.stack` | `TypeError: ...\n  at ...` | Stack trace (when applicable) |

---

## Phase 2: Huawei Cloud LTS Console Setup

### Step 1 — Create a Log Group

1. Log in to **Huawei Cloud Console** → **Service List** → **Management & Governance** → **Log Tank Service (LTS)**.
2. Click **Log Group** tab → **Create Log Group**.
3. Name: `pulseagentarts-prod`
4. Description: `PulseAgentArts production logs`
5. Click **OK**. Note the **Log Group ID** (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Step 2 — Create a Log Stream

1. Click into the log group `pulseagentarts-prod`.
2. Click **Create Log Stream**.
3. Name: `pulse-backend`
4. Click **OK**. Note the **Log Stream ID**.

### Step 3 — Create IAM Access Key (AK/SK)

1. Go to **IAM** → **Users** → your user → **Security** tab.
2. Click **Create Access Key**.
3. Save the **Access Key ID (AK)** and **Secret Access Key (SK)** — SK is only shown once.
4. Ensure the user has the **LTS Administrator** or **LTS Logs ReadOnly** permission policy.

### Step 4 — Configure the Log Ingestion Rule (JSON Format)

1. In LTS, go to your log group → log stream → **Log Ingestion** tab.
2. Click **Create Log Ingestion**.
3. Set **Log Format** = **JSON**.
4. LTS will auto-detect the JSON structure from incoming logs — no regex needed.
5. Configure **field extraction** — map these JSON keys to LTS structured fields:

| LTS Field Name | JSON Key | Data Type |
|----------------|----------|-----------|
| `time` | `time` | datetime |
| `level` | `level` | long |
| `service_name` | `service_name` | string |
| `service_version` | `service_version` | string |
| `environment` | `environment` | string |
| `trace_id` | `trace_id` | string |
| `span_id` | `span_id` | string |
| `req_id` | `req_id` | string |
| `context` | `context` | string |
| `event` | `event` | string |
| `msg` | `msg` | text |
| `err_type` | `err.type` | string |
| `err_message` | `err.message` | text |
| `err_stack` | `err.stack` | text |

6. Click **OK** to save the ingestion rule.

---

## Phase 3: Log Collection Agent

You have two options. **Option A (Fluent Bit)** is recommended for Docker environments.

### Option A — Fluent Bit (Recommended)

The Fluent Bit configuration is already in the repo at `fluent-bit/fluent-bit.conf`.

#### Step 5a — Set Environment Variables

Create a `.env` file for Fluent Bit (or export in your shell):

```bash
LTS_REGION=cn-north-4              # Your Huawei Cloud region
LTS_GROUP_ID=<your-log-group-id>   # From Step 1
LTS_STREAM_ID=<your-log-stream-id> # From Step 2
LTS_AK=<your-access-key-id>        # From Step 3
LTS_SK=<your-secret-access-key>    # From Step 3
```

#### Step 5b — Start Fluent Bit

**With Docker Compose (recommended):**

The `docker-compose.prod.yml` already includes a `fluent-bit` service. Start everything:

```bash
cd /home/Git/PulseAgentArts
docker compose -f docker-compose.prod.yml up -d fluent-bit
```

**Standalone Docker:**

```bash
docker run -d --name fluent-bit \
  --restart unless-stopped \
  -v /home/Git/PulseAgentArts/fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro \
  -v /home/Git/PulseAgentArts/fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf:ro \
  -v /var/lib/docker/containers:/var/lib/docker/containers:ro \
  -e LTS_REGION=cn-north-4 \
  -e LTS_GROUP_ID=<your-group-id> \
  -e LTS_STREAM_ID=<your-stream-id> \
  -e LTS_AK=<your-ak> \
  -e LTS_SK=<your-sk> \
  fluent/fluent-bit:3.0
```

#### Step 5c — Verify Fluent Bit is Running

```bash
docker logs fluent-bit 2>&1 | tail -10
```

You should see Fluent Bit start up and begin tailing container log files.

### Option B — ICAgent (Host-Level)

1. In the LTS console, go to **ICAgent Management** → **Install ICAgent**.
2. Follow the installation script for your OS (Linux).
3. After installation, configure the agent to collect Docker logs:
   - Add a collection configuration pointing to `/var/lib/docker/containers/*/*.log`
   - Set the log format to **JSON**
   - Associate with your log group and stream
4. The ICAgent will read Docker container logs and forward them directly to LTS.

---

## Phase 4: Verify End-to-End

### Step 6 — Generate Test Logs

Make an HTTP request to the backend with a custom trace ID:

```bash
curl -X POST http://159.138.118.60/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-trace-id: lts-test-001" \
  -d '{"email":"test@pulse.local","password":"wrong"}'
```

The response will include `x-trace-id: lts-test-001` in the headers.

### Step 7 — Check Docker Logs (Local)

Verify the structured JSON log was emitted:

```bash
docker logs pulse-backend-new 2>&1 | grep "lts-test-001"
```

Expected output:
```json
{"level":50,"time":"2026-10-08T...","service_name":"pulse-backend","trace_id":"lts-test-001","span_id":"...","req_id":"...","event":"http_exception","method":"POST","url":"/api/v1/auth/login","status_code":401,"error_code":"AUTH_INVALID_CREDENTIALS","msg":"POST /api/v1/auth/login 401 AUTH_INVALID_CREDENTIALS"}
```

### Step 8 — Check LTS Console (Remote)

1. Go to **LTS** → your log group → log stream.
2. In the search bar, enter: `trace_id: "lts-test-001"`
3. You should see the structured log entries with all fields populated.
4. Click on a log entry to see the full JSON with all fields.

### Step 9 — Create a Dashboard (Optional)

1. In LTS, go to **Dashboard** → **Create Dashboard**.
2. Add widgets:
   - **Log count by level** — pie chart of `level` field (30=info, 40=warn, 50=error)
   - **HTTP request latency** — line chart of `duration_ms` over time (filter: `event:http_request`)
   - **Error rate** — count of `level:50` over time
   - **Top error codes** — bar chart of `error_code` field (filter: `level>=50`)
3. Save the dashboard.

---

## Phase 5: Alerting (Optional)

### Step 10 — Create an Alarm Rule

1. In LTS, go to **Alarm Management** → **Create Alarm Rule**.
2. Set the condition: `level >= 50` (error or fatal).
3. Set the threshold: count > 10 in 5 minutes.
4. Configure notification: SMS, email, or webhook.
5. Associate with your log group and stream.

---

## Troubleshooting

### Logs not appearing in LTS

1. **Check Fluent Bit is running:** `docker ps | grep fluent-bit`
2. **Check Fluent Bit logs:** `docker logs fluent-bit`
3. **Check the tail position DB:** `docker exec fluent-bit cat /fluent-bit/etc/tail_db.pos`
4. **Verify AK/SK:** Ensure the AK has LTS permissions in IAM.
5. **Verify region:** Ensure `LTS_REGION` matches your Huawei Cloud region.
6. **Check network:** Fluent Bit needs outbound access to LTS endpoints.

### JSON not parsed correctly

1. Check that the `pino_json` parser in `parsers.conf` is correct.
2. Check that the `docker_json` parser handles the Docker log wrapper (`{"log":"...","stream":"stdout","time":"..."}`).
3. Test with `docker logs pulse-backend-new 2>&1 | python3 -m json.tool` to verify valid JSON.

### Fluent Bit not reading container logs

1. Ensure `/var/lib/docker/containers` is mounted: `docker exec fluent-bit ls /var/lib/docker/containers/`
2. Check the `Path` in `fluent-bit.conf` matches the actual container log path.
3. Ensure the `tail` input has `Refresh_Interval` set (new containers are detected periodically).

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/src/common/logger/logger.ts` | Pino logger instance + AsyncLocalStorage for correlation |
| `backend/src/common/logger/logger.service.ts` | NestJS LoggerService implementation (replaces default logger) |
| `backend/src/common/logger/logger.module.ts` | NestJS Global module for logger DI |
| `backend/src/common/middleware/correlation.middleware.ts` | Express middleware for trace_id/span_id/req_id |
| `backend/src/common/interceptors/logging.interceptor.ts` | HTTP request/response logging with correlation |
| `backend/src/common/filters/all-exceptions.filter.ts` | Exception logging with stack traces |
| `backend/Dockerfile` | Production container with logging env vars |
| `docker-compose.prod.yml` | Docker Compose with json-file log driver + Fluent Bit |
| `fluent-bit/fluent-bit.conf` | Fluent Bit main config (tail → parse → LTS) |
| `fluent-bit/parsers.conf` | JSON parsers for Docker + pino log formats |
| `docs/lts-logging-guide.md` | High-level LTS integration guide |
