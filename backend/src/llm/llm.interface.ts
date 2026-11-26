// LLM interfaces and types

export type LlmTask =
  | 'expense_parsing_simple'
  | 'expense_parsing_complex'
  | 'projection_explanation'
  | 'payment_strategy'
  | 'investment_advice'
  | 'dashboard_design'
  | 'payment_recommendation'
  | 'deviation_analysis'
  | 'general_chat';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  task: LlmTask;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface LlmResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface ParsedExpenseFromLlm {
  amount: number;
  currency: 'ARS' | 'USD' | 'EUR';
  category?: string;
  description?: string;
  merchantName?: string;
  paymentMethod?: 'cash' | 'card';
  cardIdentifier?: string;
  transactionDate?: string;
  confidence: number;
}

export interface LlmModelConfig {
  modelId: string;
  maxTokens: number;
  temperature: number;
}

// Model routing configuration
export const MODEL_ROUTING: Record<LlmTask, LlmModelConfig> = {
  // Fast model for simple expense parsing (e.g. "gaste 5000 en super")
  expense_parsing_simple: {
    modelId: 'deepseek-v4.1-flash-1017',
    maxTokens: 2000,
    temperature: 0.1,
  },
  // Mid-tier model for complex parsing (ambiguous messages, multiple items)
  expense_parsing_complex: {
    modelId: 'glm-5.2',
    maxTokens: 1000,
    temperature: 0.1,
  },
  // Best model for explaining projections in natural language
  projection_explanation: {
    modelId: 'glm-5.2',
    maxTokens: 2000,
    temperature: 0.3,
  },
  // Best model for payment strategy recommendations
  payment_strategy: {
    modelId: 'glm-5.2',
    maxTokens: 2000,
    temperature: 0.3,
  },
  // Best model for investment advice
  investment_advice: {
    modelId: 'glm-5.2',
    maxTokens: 2000,
    temperature: 0.4,
  },
  // Fast model for dashboard design — widget selection + JSON formatting, no reasoning needed
  dashboard_design: {
    modelId: 'deepseek-v4.1-flash-1017',
    maxTokens: 4000,
    temperature: 0.3,
  },
  // Best model for payment plan recommendation — needs reasoning + JSON
  payment_recommendation: {
    modelId: 'glm-5.2',
    maxTokens: 3000,
    temperature: 0.3,
  },
  // Best model for deviation analysis — needs reasoning about financial discrepancies
  deviation_analysis: {
    modelId: 'glm-5.2',
    maxTokens: 2000,
    temperature: 0.4,
  },
  // Mid-tier for general chat
  general_chat: {
    modelId: 'glm-5.2',
    maxTokens: 1000,
    temperature: 0.5,
  },
};
