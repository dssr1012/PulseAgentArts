import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>("GROQ_API_KEY") || "";
    this.model = this.config.get<string>("GROQ_STT_MODEL") || "whisper-large-v3-turbo";
    this.apiUrl = this.config.get<string>("GROQ_API_URL") || "https://api.groq.com/openai/v1/audio/transcriptions";
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string, filename = "audio.ogg"): Promise<TranscriptionResult | null> {
    if (!this.isAvailable()) {
      this.logger.warn("Groq API key not configured (GROQ_API_KEY), skipping transcription");
      return null;
    }

    try {
      const formData = this.buildFormData(audioBuffer, mimeType, filename);

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Groq API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      this.logger.debug(`Transcribed audio (${data.duration?.toFixed(1) || "?"}s, lang=${data.language || "?"}): "${data.text?.substring(0, 80)}..."`);

      return {
        text: (data.text || "").trim(),
        language: data.language,
        duration: data.duration,
      };
    } catch (err) {
      this.logger.error(`Transcription failed: ${(err as Error).message}`);
      return null;
    }
  }

  private buildFormData(audioBuffer: Buffer, mimeType: string, filename: string): FormData {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, filename);
    formData.append("model", this.model);
    formData.append("response_format", "json");
    formData.append("language", "es");
    return formData;
  }
}
