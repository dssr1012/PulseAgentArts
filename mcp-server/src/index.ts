import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';

const API_BASE_URL = process.env.MCP_API_BASE_URL || 'http://localhost:3000';

// Validate JWT_SECRET - throw in production, warn in development
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
  }
  console.warn('WARNING: JWT_SECRET is not set. Using insecure default. Do NOT use in production!');
}
const jwtSecret = JWT_SECRET || 'pulse-expends-dev-secret';

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
    const decoded = jwt.verify(token, jwtSecret) as any;
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

      if (!user.circleId) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'CIRCLE_NOT_FOUND',
              message: 'You do not belong to a Family Circle',
            }),
          }],
        };
      }

      const result = await apiCall(`/circles/${user.circleId}/balance?consolidated=true`, auth_token);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.data),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'AUTH_REQUIRED',
            message: error.message,
          }),
        }],
        isError: true,
      };
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
      const user = validateToken(auth_token);

      if (!user.circleId) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'CIRCLE_NOT_FOUND',
              message: 'You do not belong to a Family Circle',
            }),
          }],
          isError: true,
        };
      }

      // If no category provided, get the first default category
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

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            expense_id: result.data.id,
            status: 'created',
          }),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'TX_VALIDATION_FAILED',
            message: error.message,
          }),
        }],
        isError: true,
      };
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