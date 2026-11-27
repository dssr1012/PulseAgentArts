import { Injectable, Logger } from '@nestjs/common';
import { HuaweiCloudLlmService } from './huawei-cloud-llm.service';
import {
  LlmRequest,
  LlmResponse,
  LlmMessage,
  MODEL_ROUTING,
  ParsedExpenseFromLlm,
} from './llm.interface';

@Injectable()
export class LlmOrchestratorService {
  private readonly logger = new Logger(LlmOrchestratorService.name);

  constructor(private huaweiLlm: HuaweiCloudLlmService) {}

  async execute(request: LlmRequest): Promise<LlmResponse> {
    const modelConfig = MODEL_ROUTING[request.task];
    const startTime = Date.now();

    const { content, tokensUsed } = await this.huaweiLlm.chat(
      modelConfig,
      request.messages,
      { responseFormat: request.responseFormat },
    );

    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: modelConfig.modelId,
      tokensUsed,
      latencyMs,
    };
  }

  /**
   * Parse a WhatsApp message into a structured expense using LLM.
   * Used as fallback when the regex parser can't handle the message.
   */
  async parseExpenseMessage(
    text: string,
    availableCategories: string[],
    availableCards: Array<{ tag?: string; lastFourDigits: string; bankName: string }>,
  ): Promise<ParsedExpenseFromLlm | null> {
    if (!this.huaweiLlm.isAvailable()) {
      this.logger.warn('LLM not available, skipping expense parsing');
      return null;
    }

    const systemPrompt = `You are a financial expense parser. Extract expense information from the user's message and return it as JSON.

Rules:
- Amount: extract the numerical amount (handle comma as decimal separator, dots as thousands)
- Currency: ARS (default), USD (if mentions dollars/usd), EUR (if mentions euros)
- Category: match to one of these exact category names: ${availableCategories.join(', ')}
- Description: a brief description of what was spent
- MerchantName: the store/business name if mentioned
- PaymentMethod: "card" if mentions tarjeta/credito/debito, "cash" if mentions efectivo/contado
- CardIdentifier: the card's last 4 digits or tag name if mentioned
- TransactionDate: ISO date string if a date is mentioned (DD/MM or DD/MM/YYYY format), null if not
- Confidence: 0-1 how confident you are in the parsing

Return ONLY valid JSON, no markdown:
{"amount": 0, "currency": "ARS", "category": "", "description": "", "merchantName": "", "paymentMethod": "cash", "cardIdentifier": "", "transactionDate": null, "confidence": 0.9}`;

    const userPrompt = `Available cards: ${JSON.stringify(availableCards)}\n\nMessage to parse: "${text}"`;

    try {
      const response = await this.execute({
        task: 'expense_parsing_simple',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'json',
      });

      const parsed = JSON.parse(response.content);
      return {
        amount: this.parseLlmAmount(parsed.amount),
        currency: parsed.currency || 'ARS',
        category: parsed.category || undefined,
        description: parsed.description || undefined,
        merchantName: parsed.merchantName || undefined,
        paymentMethod: parsed.paymentMethod || 'cash',
        cardIdentifier: parsed.cardIdentifier || undefined,
        transactionDate: parsed.transactionDate || undefined,
        confidence: parseFloat(parsed.confidence) || 0,
      };
    } catch (err) {
      this.logger.error(`LLM expense parsing failed: ${err.message}`);
      return null;
    }
  }

  private parseLlmAmount(raw: any): number {
    if (typeof raw === 'number') return raw;
    const str = String(raw).trim();
    if (str.includes('.') && str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (str.includes(',')) {
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length <= 2) return parseFloat(str.replace(',', '.')) || 0;
      return parseFloat(str.replace(/,/g, '')) || 0;
    } else if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) return parseFloat(str.replace(/\./g, '')) || 0;
    }
    return parseFloat(str) || 0;
  }

  /**
   * Generate a natural language explanation of the payment strategy.
   */
  async explainPaymentStrategy(
    strategyData: any,
    userLanguage: 'es' | 'en' = 'es',
  ): Promise<string> {
    if (!this.huaweiLlm.isAvailable()) {
      return JSON.stringify(strategyData, null, 2);
    }

    const systemPrompt = userLanguage === 'es'
      ? `Eres un asesor financiero. Explica la estrategia de pago de tarjetas de crédito de forma clara y actionable en español. Usa lenguaje sencillo, no técnico. Incluye: qué tarjetas pagar, cuánto, y por qué esa estrategia ahorra más dinero. Sé conciso.`
      : `You are a financial advisor. Explain the credit card payment strategy clearly and actionable in English. Use simple, non-technical language. Include: which cards to pay, how much, and why this strategy saves the most money. Be concise.`;

    try {
      const response = await this.execute({
        task: 'payment_strategy',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Strategy data:\n${JSON.stringify(strategyData, null, 2)}` },
        ],
      });
      return response.content;
    } catch (err) {
      this.logger.error(`LLM strategy explanation failed: ${err.message}`);
      return JSON.stringify(strategyData, null, 2);
    }
  }

  /**
   * Generate a natural language summary of the 12-month projection.
   */
  async explainProjection(
    projectionData: any,
    userLanguage: 'es' | 'en' = 'es',
  ): Promise<string> {
    if (!this.huaweiLlm.isAvailable()) {
      return JSON.stringify(projectionData, null, 2);
    }

    const systemPrompt = userLanguage === 'es'
      ? `Eres un asesor financiero. Resume la proyección financiera de 12 meses de forma clara en español. Destaca: cuándo se pagan las tarjetas, el superávit mensual, y cuándo se puede empezar a invertir. Sé conciso y actionable.`
      : `You are a financial advisor. Summarize the 12-month financial projection clearly in English. Highlight: when cards will be paid off, monthly surplus, and when investment can begin. Be concise and actionable.`;

    try {
      const response = await this.execute({
        task: 'projection_explanation',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Projection data:\n${JSON.stringify(projectionData, null, 2)}` },
        ],
      });
      return response.content;
    } catch (err) {
      this.logger.error(`LLM projection explanation failed: ${err.message}`);
      return JSON.stringify(projectionData, null, 2);
    }
  }

  /**
   * Generate investment suggestions based on surplus and current investments.
   */
  async suggestInvestments(
    surplusData: any,
    currentInvestments: string[],
    userLanguage: 'es' | 'en' = 'es',
  ): Promise<string> {
    if (!this.huaweiLlm.isAvailable()) {
      return 'LLM not available for investment suggestions';
    }

    const systemPrompt = userLanguage === 'es'
      ? `Eres un asesor financiero argentino. Sugiere opciones de inversión basadas en el superávit disponible. El usuario ya tiene: ${currentInvestments.join(', ')}. Considera opciones como: CDR (Certificados de Depósito Argentinos), plazos fijos, bonos, fondos comunes, MERVAL. Sé específico sobre montos sugeridos y por qué.`
      : `You are an Argentine financial advisor. Suggest investment options based on available surplus. The user already has: ${currentInvestments.join(', ')}. Consider options like: CDR, term deposits, bonds, mutual funds, MERVAL. Be specific about suggested amounts and why.`;

    try {
      const response = await this.execute({
        task: 'investment_advice',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Financial data:\n${JSON.stringify(surplusData, null, 2)}` },
        ],
      });
      return response.content;
    } catch (err) {
      this.logger.error(`LLM investment advice failed: ${err.message}`);
      return 'Unable to generate investment suggestions at this time';
    }
  }
}
