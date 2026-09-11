import 'dotenv/config';
import * as fs from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';

const API_BASE_URL = process.env.MCP_API_BASE_URL || 'http://localhost:3000';

// Resolve JWT verification key: prefer RSA public key (RS256), fall back to symmetric secret
const JWT_PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH;
const JWT_SECRET = process.env.JWT_SECRET;

let verifyKey: string | Buffer;
let verifyAlgorithms: string[];

if (JWT_PUBLIC_KEY_PATH && fs.existsSync(JWT_PUBLIC_KEY_PATH)) {
  verifyKey = fs.readFileSync(JWT_PUBLIC_KEY_PATH, 'utf8');
  verifyAlgorithms = ['RS256'];
} else if (JWT_SECRET) {
  verifyKey = JWT_SECRET;
  verifyAlgorithms = ['HS256'];
} else {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET or JWT_PUBLIC_KEY_PATH is required in production');
    process.exit(1);
  }
  console.warn('WARNING: No JWT key configured. Using insecure default. Do NOT use in production!');
  verifyKey = 'pulse-expends-dev-secret';
  verifyAlgorithms = ['HS256'];
}

// Create MCP server
const server = new McpServer({
  name: 'pulse-expends-mcp',
  version: '1.0.0',
});

/**
 * Validate JWT token and extract user info
 */
function validateToken(token: string): { userId: string; circleId: string | null; role: string | null } {
  try {
    const decoded = jwt.verify(token, verifyKey, { algorithms: verifyAlgorithms }) as any;
    return {
      userId: decoded.sub,
      circleId: decoded.circleId || null,
      role: decoded.role || null,
    };
  } catch {
    throw new Error('Invalid or expired authentication token');
  }
}

/**
 * Make authenticated API call to the NestJS backend
 */
async function apiCall(endpoint: string, token: string, method: string = 'GET', body?: any) {
  const response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'API error' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

function requireCircle(user: ReturnType<typeof validateToken>) {
  if (!user.circleId) {
    throw new Error('CIRCLE_NOT_FOUND: You do not belong to a Family Circle');
  }
}

function textResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function errorResult(code: string, message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }], isError: true };
}

// ============================================================
// Tool: get_family_balance
// ============================================================
server.tool(
  'get_family_balance',
  'Get the balance summary for the authenticated user\'s Family Circle',
  {
    auth_token: z.string().describe('JWT authentication token'),
  },
  async ({ auth_token }) => {
    try {
      const user = validateToken(auth_token);
      requireCircle(user);
      const result = await apiCall(`/circles/${user.circleId}/balance?consolidated=true`, auth_token);
      return textResult(result.data);
    } catch (error: any) {
      return errorResult('AUTH_REQUIRED', error.message);
    }
  },
);

// ============================================================
// Tool: list_expenses
// ============================================================
server.tool(
  'list_expenses',
  'List recent expenses for the Family Circle',
  {
    auth_token: z.string().describe('JWT authentication token'),
    page: z.number().int().positive().optional().describe('Page number (default 1)'),
    limit: z.number().int().positive().max(100).optional().describe('Items per page (default 20)'),
    currency: z.enum(['ARS', 'USD', 'EUR']).optional().describe('Filter by currency'),
  },
  async ({ auth_token, page, limit, currency }) => {
    try {
      const user = validateToken(auth_token);
      requireCircle(user);
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));
      if (limit) params.set('limit', String(limit));
      if (currency) params.set('currency', currency);
      const query = params.toString() ? `?${params.toString()}` : '';
      const result = await apiCall(`/expenses${query}`, auth_token);
      return textResult(result.data);
    } catch (error: any) {
      return errorResult('API_ERROR', error.message);
    }
  },
);

// ============================================================
// Tool: list_categories
// ============================================================
server.tool(
  'list_categories',
  'List all expense categories for the Family Circle',
  {
    auth_token: z.string().describe('JWT authentication token'),
  },
  async ({ auth_token }) => {
    try {
      validateToken(auth_token);
      const result = await apiCall('/categories', auth_token);
      return textResult(result.data);
    } catch (error: any) {
      return errorResult('API_ERROR', error.message);
    }
  },
);

// ============================================================
// Tool: add_expense_intent
// ============================================================
server.tool(
  'add_expense_intent',
  'Create an expense on behalf of the user via agentic assistant',
  {
    auth_token: z.string().describe('JWT authentication token'),
    amount: z.number().positive().describe('Expense amount'),
    currency: z.enum(['ARS', 'USD', 'EUR']).describe('Currency code'),
    category_id: z.string().optional().describe('Category ID'),
    description: z.string().optional().describe('Expense description'),
    merchant_name: z.string().optional().describe('Merchant name'),
    transaction_date: z.string().optional().describe('ISO 8601 date (defaults to today)'),
  },
  async ({ auth_token, amount, currency, category_id, description, merchant_name, transaction_date }) => {
    try {
      validateToken(auth_token);

      let categoryId = category_id;
      if (!categoryId) {
        const categoriesResult = await apiCall('/categories', auth_token);
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
      };

      if (categoryId) expenseData.categoryId = categoryId;
      if (description) expenseData.description = description;
      if (merchant_name) expenseData.merchantName = merchant_name;

      const result = await apiCall('/expenses', auth_token, 'POST', expenseData);
      return textResult({ expense_id: result.data.id, status: 'created' });
    } catch (error: any) {
      return errorResult('TX_VALIDATION_FAILED', error.message);
    }
  },
);

// ============================================================
// Tool: add_income
// ============================================================
server.tool(
  'add_income',
  'Record an income on behalf of the user via agentic assistant',
  {
    auth_token: z.string().describe('JWT authentication token'),
    amount: z.number().positive().describe('Income amount'),
    currency: z.enum(['ARS', 'USD', 'EUR']).describe('Currency code'),
    description: z.string().optional().describe('Income description'),
    income_date: z.string().optional().describe('ISO 8601 date (defaults to today)'),
  },
  async ({ auth_token, amount, currency, description, income_date }) => {
    try {
      validateToken(auth_token);

      const incomeData: any = {
        amount,
        currency,
        incomeDate: income_date || new Date().toISOString().split('T')[0],
      };

      if (description) incomeData.description = description;

      const result = await apiCall('/incomes', auth_token, 'POST', incomeData);
      return textResult({ income_id: result.data.id, status: 'created' });
    } catch (error: any) {
      return errorResult('TX_VALIDATION_FAILED', error.message);
    }
  },
);

// ============================================================
// Tool: get_exchange_rates
// ============================================================
server.tool(
  'get_exchange_rates',
  'Get current exchange rates (ARS, USD, EUR)',
  {
    auth_token: z.string().describe('JWT authentication token'),
  },
  async ({ auth_token }) => {
    try {
      validateToken(auth_token);
      const result = await apiCall('/exchange-rates', auth_token);
      return textResult(result.data);
    } catch (error: any) {
      return errorResult('API_ERROR', error.message);
    }
  },
);

// ============================================================
// Start server
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PulseExpends MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
