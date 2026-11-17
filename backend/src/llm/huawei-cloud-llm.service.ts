import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmMessage, LlmModelConfig } from './llm.interface';

export interface HuaweiCloudChatRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'text' | 'json_object' };
}

export interface HuaweiCloudChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class HuaweiCloudLlmService {
  private readonly logger = new Logger(HuaweiCloudLlmService.name);
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('HUAWEI_MASS_ENDPOINT', '');
    this.apiKey = this.config.get<string>('HUAWEI_MASS_API_KEY', '');
  }

  isAvailable(): boolean {
    return !!this.endpoint && !!this.apiKey;
  }

  async chat(
    modelConfig: LlmModelConfig,
    messages: LlmMessage[],
    options?: { responseFormat?: 'text' | 'json' },
  ): Promise<{ content: string; tokensUsed: number }> {
    if (!this.isAvailable()) {
      throw new Error('Huawei Cloud LLM not configured. Set HUAWEI_MASS_ENDPOINT and HUAWEI_MASS_API_KEY.');
    }

    const requestBody: HuaweiCloudChatRequest = {
      model: modelConfig.modelId,
      messages,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
      stream: false,
    };

    if (options?.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
    }

    const startTime = Date.now();

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      this.logger.error(`Huawei Cloud LLM error ${response.status}: ${errorText}`);
      throw new Error(`LLM API error ${response.status}: ${errorText}`);
    }

    const data: HuaweiCloudChatResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('LLM returned no choices');
    }

    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    this.logger.debug(
      `LLM call: model=${modelConfig.modelId}, tokens=${tokensUsed}, latency=${latencyMs}ms`,
    );

    return { content, tokensUsed };
  }
}
