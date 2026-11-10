# PulseExpends MCP Server

Model Context Protocol (MCP) server for PulseExpends — enables AI agents (Claude, ChatGPT, Gemini) to read and manage family expenses via natural language.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_family_balance` | Balance summary for your Family Circle (income, expenses, net, breakdowns) |
| `list_expenses` | Paginated expense list with optional currency filter |
| `list_categories` | All expense categories in your circle |
| `add_expense` | Create a new expense (auto-defaults category if omitted) |
| `add_income` | Record a new income entry |
| `get_exchange_rates` | Current ARS/USD/EUR exchange rates |
| `list_circles` | List all Family Circles you belong to |

No `auth_token` parameter needed — the server authenticates internally via a dedicated MCP user account.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | Transport mode: `sse` or `stdio` |
| `MCP_PORT` | `3002` | Port for SSE transport |
| `MCP_API_BASE_URL` | `http://localhost:3000` | Backend API base URL |
| `MCP_API_KEY` | — | API key for SSE auth (clients send as Bearer token) |
| `MCP_USER_EMAIL` | — | MCP service account email for backend login |
| `MCP_USER_PASSWORD` | — | MCP service account password |

## Agent Configuration

### Claude Desktop (stdio)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pulse-expends": {
      "command": "npx",
      "args": ["ts-node-dev", "--transpile-only", "src/index.ts"],
      "cwd": "/path/to/mcp-server",
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MCP_API_BASE_URL": "https://your-domain.com",
        "MCP_USER_EMAIL": "mcp-agent@example.com",
        "MCP_USER_PASSWORD": "your-password"
      }
    }
  }
}
```

### ChatGPT / Gemini / Remote Agents (SSE)

Use the SSE endpoint URL with the API key as a Bearer token:

```
SSE URL:  https://your-domain.com/mcp/mcp
API Key:  your-mcp-api-key
```

**ChatGPT (Custom GPT + Actions):**
1. Go to Settings → Tools → MCP
2. Add server URL: `https://your-domain.com/mcp/mcp`
3. Set Authorization header: `Bearer your-mcp-api-key`

**Gemini (MCP extension):**
1. Go to Settings → Extensions → MCP
2. Add SSE endpoint: `https://your-domain.com/mcp/mcp`
3. Set API key: `your-mcp-api-key`

**Generic SSE client:**
```
GET  https://your-domain.com/mcp/mcp
  Header: Authorization: Bearer <api-key>
  → SSE stream, first event contains message endpoint URL

POST https://your-domain.com/messages?sessionId=<session-id>
  Header: Authorization: Bearer <api-key>
  Body:  JSON-RPC 2.0 message
```

## DEV Environment

| Setting | Value |
|---------|-------|
| SSE URL | `http://<host-ip>:8080/mcp/mcp` |
| Messages URL | `http://<host-ip>:8080/messages` |
| Health check | `http://<host-ip>:8080/mcp/health` |
| API Key | `mcp-dev-key-2026` |
| MCP User | `mcp-agent@example.com` |

## Docker

```bash
docker run -d \
  --name pulse-mcp-dev \
  --network pulseagentarts_dev \
  -p 3002:3002 \
  -v pulseagentarts_dev_src:/app:ro \
  -w /app/mcp-server \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3002 \
  -e MCP_API_BASE_URL=http://pulse-backend-dev:3000 \
  -e MCP_API_KEY=mcp-dev-key-2026 \
  -e MCP_USER_EMAIL=mcp-agent@example.com \
  -e MCP_USER_PASSWORD=McpAgent123! \
  node:22-slim \
  npx ts-node-dev --transpile-only --respawn src/index.ts
```
