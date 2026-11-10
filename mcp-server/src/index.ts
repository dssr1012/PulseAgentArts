import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const API_BASE_URL = process.env.MCP_API_BASE_URL || 'http://localhost:3000';
const MCP_TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const MCP_API_KEY = process.env.MCP_API_KEY;
const MCP_USER_EMAIL = process.env.MCP_USER_EMAIL;
const MCP_USER_PASSWORD = process.env.MCP_USER_PASSWORD;
const MCP_PORT = parseInt(process.env.MCP_PORT || '3002', 10);

let cachedJwt: string | null = null;
let jwtExpiresAt = 0;
let cachedCircleId: string | null = null;

async function getJwt(): Promise<string> {
  if (cachedJwt && Date.now() < jwtExpiresAt) {
    return cachedJwt;
  }

  if (!MCP_USER_EMAIL || !MCP_USER_PASSWORD) {
    throw new Error('MCP_USER_EMAIL and MCP_USER_PASSWORD are required for SSE transport');
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MCP_USER_EMAIL, password: MCP_USER_PASSWORD }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(`MCP auth failed: ${JSON.stringify(error.message) || response.status}`);
  }

  const data = await response.json();
  cachedJwt = data.data.accessToken;
  jwtExpiresAt = Date.now() + 50 * 60 * 1000;
  cachedCircleId = null;
  return cachedJwt!;
}

async function getCircleId(): Promise<string> {
  if (cachedCircleId) return cachedCircleId;
  const result = await apiCall('/circles');
  const circles = result.data;
  if (!circles || circles.length === 0) {
    throw new Error('User has no Family Circles');
  }
  cachedCircleId = circles[0].id;
  return cachedCircleId;
}

async function apiCall(endpoint: string, method: string = 'GET', body?: any) {
  const token = await getJwt();
  const response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    cachedJwt = null;
    jwtExpiresAt = 0;
    const retryToken = await getJwt();
    const retryResponse = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${retryToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!retryResponse.ok) {
      const error = await retryResponse.json().catch(() => ({ message: 'API error' }));
      throw new Error(JSON.stringify(error.message) || `API error: ${retryResponse.status}`);
    }
    return retryResponse.json();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API error' }));
    throw new Error(JSON.stringify(error.message) || `API error: ${response.status}`);
  }

  return response.json();
}

function textResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(code: string, message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }], isError: true };
}

function createServer(): McpServer {
  const server = new McpServer({
    name: 'pulse-expends-mcp',
    version: '1.0.0',
  });

  server.tool(
    'get_family_balance',
    'Get the balance summary for your Family Circle — shows total income, total expenses, net balance, and breakdowns by currency and category',
    {},
    async () => {
      try {
        const circleId = await getCircleId();
        const result = await apiCall(`/circles/${circleId}/balance?consolidated=true`);
        return textResult(result.data);
      } catch (error: any) {
        return errorResult('API_ERROR', error.message);
      }
    },
  );

  server.tool(
    'list_expenses',
    'List recent expenses for your Family Circle. Returns paginated results with category, amount, currency, description, and date.',
    {
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().max(100).optional().describe('Items per page (default 20, max 100)'),
      currency: z.enum(['ARS', 'USD', 'EUR']).optional().describe('Filter by currency'),
    },
    async ({ page, limit, currency }) => {
      try {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        if (currency) params.set('currency', currency);
        const query = params.toString() ? `?${params.toString()}` : '';
        const result = await apiCall(`/expenses${query}`);
        return textResult(result.data);
      } catch (error: any) {
        return errorResult('API_ERROR', error.message);
      }
    },
  );

  server.tool(
    'list_categories',
    'List all expense categories available in your Family Circle. Use the category IDs when creating expenses.',
    {},
    async () => {
      try {
        const result = await apiCall('/categories');
        return textResult(result.data);
      } catch (error: any) {
        return errorResult('API_ERROR', error.message);
      }
    },
  );

  server.tool(
    'add_expense',
    'Create a new expense in your Family Circle. The expense will be recorded as confirmed. If no category_id is provided, the default category will be used.',
    {
      amount: z.number().positive().describe('Expense amount (e.g. 1500.50)'),
      currency: z.enum(['ARS', 'USD', 'EUR']).describe('Currency code'),
      category_id: z.string().optional().describe('Category ID (use list_categories to find available IDs)'),
      description: z.string().optional().describe('Expense description (e.g. "Supermercado Carrefour")'),
      merchant_name: z.string().optional().describe('Merchant name'),
      transaction_date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
      payment_method: z.enum(['cash', 'card']).optional().describe('Payment method (default: cash)'),
    },
    async ({ amount, currency, category_id, description, merchant_name, transaction_date, payment_method }) => {
      try {
        let categoryId = category_id;
        if (!categoryId) {
          const categoriesResult = await apiCall('/categories');
          const categories = categoriesResult.data;
          const defaultCategory = categories?.find((c: any) => c.isDefault);
          categoryId = defaultCategory?.id;
        }

        const expenseData: any = {
          amount,
          currency,
          source: 'mcp',
          confirmationStatus: 'confirmed',
          transactionDate: transaction_date || new Date().toISOString().split('T')[0],
          paymentMethod: payment_method || 'cash',
        };

        if (categoryId) expenseData.categoryId = categoryId;
        if (description) expenseData.description = description;
        if (merchant_name) expenseData.merchantName = merchant_name;

        const result = await apiCall('/expenses', 'POST', expenseData);
        return textResult({ expense_id: result.data.id, status: 'created', ...result.data });
      } catch (error: any) {
        return errorResult('TX_VALIDATION_FAILED', error.message);
      }
    },
  );

  server.tool(
    'add_income',
    'Record a new income in your Family Circle. Useful for tracking salary, freelance payments, etc.',
    {
      amount: z.number().positive().describe('Income amount'),
      currency: z.enum(['ARS', 'USD', 'EUR']).describe('Currency code'),
      description: z.string().optional().describe('Income description (e.g. "Salary November 2026")'),
      income_date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
    },
    async ({ amount, currency, description, income_date }) => {
      try {
        const incomeData: any = {
          amount,
          currency,
          incomeDate: income_date || new Date().toISOString().split('T')[0],
        };

        if (description) incomeData.description = description;

        const result = await apiCall('/incomes', 'POST', incomeData);
        return textResult({ income_id: result.data.id, status: 'created', ...result.data });
      } catch (error: any) {
        return errorResult('TX_VALIDATION_FAILED', error.message);
      }
    },
  );

  server.tool(
    'get_exchange_rates',
    'Get current exchange rates for ARS, USD, EUR with staleness indicator',
    {},
    async () => {
      try {
        const result = await apiCall('/exchange-rates');
        return textResult(result.data);
      } catch (error: any) {
        return errorResult('API_ERROR', error.message);
      }
    },
  );

  server.tool(
    'list_circles',
    'List all Family Circles the user belongs to with their role and member count',
    {},
    async () => {
      try {
        const result = await apiCall('/circles');
        return textResult(result.data);
      } catch (error: any) {
        return errorResult('API_ERROR', error.message);
      }
    },
  );

  return server;
}

async function main() {
  if (MCP_TRANSPORT === 'sse') {
    const app = express();
    const transports: Record<string, SSEServerTransport> = {};

    app.use((req, res, next) => {
      if (req.path === '/health') return next();
      const authHeader = req.headers.authorization;
      if (!MCP_API_KEY) return next();
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing API key. Provide Authorization: Bearer <key>' });
      }
      const apiKey = authHeader.slice(7);
      if (apiKey !== MCP_API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      next();
    });

    app.get('/health', (_req, res) => res.json({ status: 'ok', transport: 'sse' }));

    app.get('/mcp', async (_req, res) => {
      try {
        const transport = new SSEServerTransport('/messages', res);
        const sessionId = transport.sessionId;
        transports[sessionId] = transport;
        transport.onclose = () => { delete transports[sessionId]; };
        const server = createServer();
        await server.connect(transport);
        console.error(`SSE session established: ${sessionId}`);
      } catch (error) {
        console.error('SSE setup error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    });

    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];
      if (!transport) {
        return res.status(404).json({ error: 'Session not found' });
      }
      try {
        await transport.handlePostMessage(req, res);
      } catch (error) {
        console.error('Message handling error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Message handling failed' });
      }
    });

    app.listen(MCP_PORT, '0.0.0.0', () => {
      console.log(`PulseExpends MCP Server (SSE) listening on port ${MCP_PORT}`);
      console.log(`  SSE endpoint:  http://0.0.0.0:${MCP_PORT}/mcp`);
      console.log(`  Messages:      http://0.0.0.0:${MCP_PORT}/messages`);
      console.log(`  Health:        http://0.0.0.0:${MCP_PORT}/health`);
    });
  } else {
    const transport = new StdioServerTransport();
    const server = createServer();
    await server.connect(transport);
    console.error('PulseExpends MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
