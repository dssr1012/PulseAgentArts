import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { ParsedExpenseFromLlm } from "../llm/llm.interface";

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(private config: ConfigService) {
    const encKey = this.config.get<string>("GROQ_API_KEY_ENC") || "";
    const masterKey = this.config.get<string>("STATEMENT_PASSWORD_KEY") || "";
    this.apiKey = this.decryptKey(encKey, masterKey);
    this.model = this.config.get<string>("GROQ_VISION_MODEL") || "qwen/qwen3.8-27b";
    this.apiUrl = this.config.get<string>("GROQ_VISION_API_URL") || "https://api.groq.com/openai/v1/chat/completions";
  }

  private decryptKey(encKey: string, masterKey: string): string {
    if (!encKey || !masterKey) return "";
    try {
      const key = crypto.createHash("sha256").update(masterKey).digest();
      const [ivB, tagB, ctB] = encKey.split(":");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64"), { authTagLength: 16 });
      decipher.setAuthTag(Buffer.from(tagB, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
    } catch {
      return "";
    }
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async extractExpense(
    imageBuffer: Buffer,
    mimeType: string,
    availableCategories: string[],
    availableCards: Array<{ tag?: string; lastFourDigits: string; bankName: string }>,
    caption: string = "",
  ): Promise<ParsedExpenseFromLlm | null> {
    if (!this.isAvailable()) {
      this.logger.warn("Groq API key not configured, skipping vision extraction");
      return null;
    }

    try {
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const systemPrompt = `You are a financial receipt parser. Extract expense information from the receipt/invoice image and return it as JSON.

Rules:
- Amount: extract the TOTAL amount from the receipt (Argentine format: dot = thousands, comma = decimal, e.g. "1.234,56" = 1234.56)
- Currency: ARS (default for Argentine receipts), USD (if receipt is in dollars), EUR (if in euros)
- Category: match to one of these exact category names: ${availableCategories.join(", ")}
- Description: a brief description of what was purchased (e.g. "Supermercado", "Farmacia", "Restaurant")
- MerchantName: the store/business name from the receipt
- PaymentMethod: "card" if receipt shows tarjeta/credito/debito, "cash" if efectivo/contado
- CardIdentifier: the card's last 4 digits if visible on the receipt
- TransactionDate: ISO date string if date is visible (DD/MM/YYYY or DD/MM/YY format), null if not
- Confidence: 0-1 how confident you are in the extraction

Return ONLY valid JSON, no markdown:
{"amount": 0, "currency": "ARS", "category": "", "description": "", "merchantName": "", "paymentMethod": "cash", "cardIdentifier": "", "transactionDate": null, "confidence": 0.9}`;

      const captionContext = caption.trim() ? `\n\nUser caption (use this to override image data if conflicting, e.g. payment method, card): "${caption.trim()}"` : '';
      const userPrompt = `Available cards: ${JSON.stringify(availableCards)}${captionContext}\n\nExtract the expense data from this receipt image.`;

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ]},
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Groq Vision API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || "";

      const parsed = JSON.parse(content);
      this.logger.log(`Vision extracted: amount=${parsed.amount}, merchant=${parsed.merchantName}, confidence=${parsed.confidence}`);

      return {
        amount: this.parseAmount(parsed.amount),
        currency: parsed.currency || "ARS",
        category: parsed.category || undefined,
        description: parsed.description || undefined,
        merchantName: parsed.merchantName || undefined,
        paymentMethod: parsed.paymentMethod || "cash",
        cardIdentifier: parsed.cardIdentifier || undefined,
        transactionDate: this.parseDate(parsed.transactionDate),
        confidence: parseFloat(parsed.confidence) || 0,
      };
    } catch (err) {
      this.logger.error(`Vision extraction failed: ${(err as Error).message}`);
      return null;
    }
  }

  private parseDate(raw: any): string | undefined {
    if (!raw || raw === "null" || raw === null) return undefined;
    const str = String(raw).trim();

    let date: Date | null = null;

    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/);
    if (iso) {
      date = new Date(str);
    } else {
      const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dmy) {
        let year = parseInt(dmy[3], 10);
        if (year < 100) year += 2000;
        date = new Date(year, parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
      }
    }

    if (!date || isNaN(date.getTime())) {
      this.logger.warn(`Invalid transactionDate from vision: "${str}", using current date`);
      return undefined;
    }

    return date.toISOString();
  }

  private parseAmount(raw: any): number {
    if (typeof raw === "number") return raw;
    const str = String(raw).trim();
    if (str.includes(".") && str.includes(",")) {
      return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    } else if (str.includes(",")) {
      const parts = str.split(",");
      if (parts.length === 2 && parts[1].length <= 2) return parseFloat(str.replace(",", ".")) || 0;
      return parseFloat(str.replace(/,/g, "")) || 0;
    } else if (str.includes(".")) {
      const parts = str.split(".");
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) return parseFloat(str.replace(/\./g, "")) || 0;
    }
    return parseFloat(str) || 0;
  }
}
