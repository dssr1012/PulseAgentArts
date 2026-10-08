# Huawei Cloud LTS — JSON Log Ingest Guide

## Overview

The PulseAgentArts backend emits structured JSON logs via `pino` to `process.stdout`.
Docker captures these as JSON lines in `/var/lib/docker/containers/*/*.log`.
Fluent Bit tails these files, parses the nested JSON, and forwards to Huawei Cloud LTS.

## Log Format

Each log line is a JSON object with these fields:

```json
{
  "level": 30,
  "time": "2026-10-08T14:15:48.813Z",
  "service_name": "pulse-backend",
  "service_version": "1.0.0",
  "environment": "production",
  "trace_id": "abc123",
  "span_id": "def456",
  "req_id": "ghi789",
  "context": "AuthService",
  "event": "http_request",
  "msg": "POST /api/v1/auth/login 151ms",
  "err": {
    "type": "TypeError",
    "message": "...",
    "stack": "..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `level` | int | Pino numeric level (10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal) |
| `time` | string | ISO-8601 UTC timestamp |
| `service_name` | string | Always `pulse-backend` |
| `service_version` | string | App version |
| `environment` | string | `production` / `development` |
| `trace_id` | string | Correlation trace ID (propagated from `x-trace-id` header) |
| `span_id` | string | Correlation span ID |
| `req_id` | string | Request ID (from `x-request-id` header or generated) |
| `context` | string | NestJS logger context (class name) |
| `event` | string | Event type (e.g., `http_request`, `http_exception`, `redis_connected`) |
| `msg` | string | Human-readable message |
| `err` | object | Serialized error with `type`, `message`, `stack` |

## Step 1: Create LTS Log Group and Stream

1. Log in to the Huawei Cloud console.
2. Navigate to **Log Tank Service (LTS)**.
3. Create a **Log Group** (e.g., `pulseagentarts-prod`).
4. Create a **Log Stream** within the group (e.g., `pulse-backend`).
5. Note the **LTS Group ID** and **LTS Stream ID** from the stream details.

## Step 2: Create IAM Access Key

1. Go to **IAM** → **Users** → your user → **Access Keys**.
2. Create an **AK/SK** pair with LTS permissions.
3. Note the **Access Key ID** and **Secret Access Key**.

## Step 3: Configure Fluent Bit

Set the following environment variables for the Fluent Bit container (or DaemonSet):

```bash
LTS_REGION=cn-north-4          # Your Huawei Cloud region
LTS_GROUP_ID=<your-group-id>   # From Step 1
LTS_STREAM_ID=<your-stream-id> # From Step 1
LTS_AK=<your-access-key-id>    # From Step 2
LTS_SK=<your-secret-key>       # From Step 2
```

The Fluent Bit configuration is at `fluent-bit/fluent-bit.conf`:
- **INPUT**: Tails `/var/lib/docker/containers/*/*.log` (Docker JSON log files)
- **FILTER (grep)**: Only processes logs from the `pulse-backend` container
- **FILTER (parser)**: Parses the nested `log` field as JSON using the `pino_json` parser
- **OUTPUT (lts)**: Forwards to Huawei Cloud LTS with the AK/SK credentials
- **OUTPUT (stdout)**: Also echoes to stdout for local debugging

## Step 4: Create JSON Parse Rule in LTS

In the LTS console, create a **log ingestion rule** for the `pulse-backend` stream:

1. Go to **LTS** → your log group → your log stream → **Log Ingestion**.
2. Set **Log Format** to **JSON**.
3. LTS will automatically recognize the JSON fields from the pino output.
4. Map the following fields for structured search:

| LTS Field | JSON Key | Type |
|-----------|----------|------|
| `time` | `time` | datetime |
| `level` | `level` | long |
| `service_name` | `service_name` | string |
| `environment` | `environment` | string |
| `trace_id` | `trace_id` | string |
| `span_id` | `span_id` | string |
| `req_id` | `req_id` | string |
| `context` | `context` | string |
| `event` | `event` | string |
| `msg` | `msg` | string |
| `err.type` | `err.type` | string |
| `err.message` | `err.message` | string |
| `err.stack` | `err.stack` | string |

5. No regex parse rules are needed — LTS ingests JSON directly.

## Step 5: Verify Ingestion

1. Make an HTTP request to the backend: `curl http://<host>/api/v1/auth/login -X POST ...`
2. In the LTS console, go to your log stream and search for the `trace_id` from the response header.
3. You should see the structured log entries with all fields populated.

## Alternative: ICAgent (Host-Level Collection)

Instead of Fluent Bit, you can install the **ICAgent** directly on the host:

1. Install ICAgent following the Huawei Cloud documentation.
2. Configure ICAgent to collect Docker container logs from `/var/lib/docker/containers/*/*.log`.
3. Set the log format to **JSON** in the ICAgent configuration.
4. ICAgent will forward the JSON logs directly to LTS without needing Fluent Bit.

## Docker Log Driver Configuration

The `docker-compose.prod.yml` uses the `json-file` driver with rotation:

```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"    # Rotate at 50MB
    max-file: "5"      # Keep 5 rotated files
```

This ensures Docker doesn't truncate JSON lines and keeps disk usage bounded.
