import { Injectable, Logger } from '@nestjs/common';

export interface ParsedExpenseMessage {
  amount: number;
  description: string;
  currency: 'ARS' | 'USD' | 'EUR';
  paymentMethod: 'cash' | 'card';
  cardIdentifier?: string;
  categoryName?: string;
  merchantName?: string;
  transactionDate?: string;
}

@Injectable()
export class WhatsappMessageParser {
  private readonly logger = new Logger(WhatsappMessageParser.name);

  private readonly categoryKeywords: Record<string, string[]> = {
    Alimentación: ['super', 'supermercado', 'comida', 'almacen', 'verduleria', 'carniceria', 'panaderia', 'restaurant', 'restoran', 'comida', 'almuerzo', 'cena', 'desayuno', 'merienda', 'cafe', 'groceries', 'food', 'market'],
    Servicios: ['luz', 'agua', 'gas', 'internet', 'cable', 'telefono', 'celular', 'streaming', 'netflix', 'spotify', 'youtube', 'servicio', 'bill', 'utility'],
    Transporte: ['nafta', 'combustible', 'gasolina', 'subte', 'colectivo', 'taxi', 'uber', 'cabify', 'tren', 'peaje', 'estacionamiento', 'parking', 'gas', 'fuel', 'transport'],
    Salud: ['farmacia', 'medico', 'dentista', 'clinica', 'hospital', 'obra social', 'pharmacy', 'doctor', 'health', 'medical'],
  };

  parse(text: string): ParsedExpenseMessage | null {
    const trimmed = text.trim();
    const normalized = trimmed.toLowerCase();
    if (!normalized) return null;

    const categoryName = this.extractKeyValue(trimmed, ['categoria', 'cat']);
    const merchantName = this.extractKeyValue(trimmed, ['negocio', 'comercio']);
    const transactionDate = this.extractDate(trimmed);

    const cleaned = this.stripKeyValues(trimmed);
    const cleanedLower = cleaned.toLowerCase();

    const amount = this.extractAmount(cleanedLower);
    if (amount === null || amount <= 0) return null;

    const description = this.extractDescription(cleaned, amount);
    const currency = this.extractCurrency(cleanedLower);
    const paymentMethod = this.extractPaymentMethod(cleanedLower);
    const cardIdentifier = paymentMethod === 'card'
      ? this.extractCardIdentifier(cleanedLower, amount)
      : undefined;

    return { amount, description, currency, paymentMethod, cardIdentifier, categoryName, merchantName, transactionDate };
  }

  suggestCategory(text: string): string | null {
    const normalized = text.trim().toLowerCase();
    const words = normalized.split(/\s+/);
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      for (const kw of keywords) {
        if (words.some((w) => w === kw || w.startsWith(kw) && kw.length >= 4)) return category;
      }
    }
    return null;
  }

  private extractAmount(text: string): number | null {
    const patterns = [
      /(?:gaste|gasté|gasto|gastó|gastados|gastadas|spent|spend|paid|pague|pagué|pago|pagó)\s+([\d.,]+)/i,
      /([\d.,]+)\s+(?:pesos|ars|usd|dolares|dólares|euros|eur)/i,
      /(?:usd|dolares|dólares|u\$s)\s+([\d.,]+)/i,
      /(?:euros|eur|€)\s+([\d.,]+)/i,
      /([\d.,]+)\s+(?:en|on|for|para)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = this.parseAmount(match[1]);
        if (parsed !== null && parsed > 0) return parsed;
      }
    }

    const bareNumber = text.match(/^([\d.,]+)\s+/);
    if (bareNumber) {
      const parsed = this.parseAmount(bareNumber[1]);
      if (parsed !== null && parsed > 0) return parsed;
    }

    return null;
  }

  private parseAmount(raw: string): number | null {
    let cleaned = raw.replace(/\s/g, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        cleaned = cleaned.replace(/\./g, '');
      }
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private extractDescription(original: string, amount: number): string {
    let desc = original;

    desc = desc.replace(/^(gaste|gasté|gasto|gastó|gastados|gastadas|spent|spend|paid|pague|pagué|pago|pagó)\s+/i, '');
    desc = desc.replace(/^(pesos|ars|usd|dolares|dólares|euros|eur|u\$s)\s+/i, '');
    desc = desc.replace(new RegExp(`^${amount.toString().replace('.', '\\.')}\\s*`), '');
    desc = desc.replace(/^(en|on|for|para|de)\s+/i, '');
    desc = desc.replace(/\s+(pesos|ars|usd|dolares|dólares|euros|eur|u\$s)$/i, '');
    desc = desc.replace(/\s+(pesos|ars|usd|dolares|dólares|euros|eur|u\$s)\s+/i, ' ');
    desc = desc.replace(/^(pesos|ars|usd|dolares|dólares|euros|eur|u\$s)\s+/i, '');
    desc = desc.replace(/\b(con\s+)?(tarjeta|tc|credito|crédito|debito|débito|card|credit|debit|efectivo|cash|contado|dinero)\b/gi, '');
    desc = desc.replace(/\b(tag|etiqueta)\s*[:\s]\s*.+/gi, '');
    desc = desc.replace(/\s+\b\d{4}\b(?!\s*(pesos|ars|usd|dolares|dólares|euros|eur))/g, (match) => {
      const digits = match.trim();
      return digits !== amount.toString() ? '' : match;
    });
    desc = desc.trim();

    if (!desc) desc = 'Gasto WhatsApp';
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  private extractCurrency(text: string): 'ARS' | 'USD' | 'EUR' {
    if (/\b(usd|dolares|dólares|\$us|u\$s)\b/.test(text)) return 'USD';
    if (/\b(eur|euros|€)\b/.test(text)) return 'EUR';
    return 'ARS';
  }

  private extractPaymentMethod(text: string): 'cash' | 'card' {
    if (/\b(tarjeta|tc|credito|crédito|debito|débito|card|credit|debit|visa|mastercard|amex)\b/.test(text)) {
      return 'card';
    }
    if (/\b(efectivo|cash|contado|dinero)\b/.test(text)) {
      return 'cash';
    }
    return 'cash';
  }

  private extractCardIdentifier(text: string, amount: number): string | undefined {
    const amountStr = amount.toString();
    const fourDigitMatches = text.match(/\b(\d{4})\b/g) || [];
    const nonAmountDigits = fourDigitMatches.filter((d) => d !== amountStr);
    if (nonAmountDigits.length > 0) {
      return nonAmountDigits[0];
    }

    const tagMatch = text.match(/\b(?:tag|etiqueta)\s*[:\s]\s*(.+)/);
    if (tagMatch) {
      return tagMatch[1].trim();
    }

    return undefined;
  }

  private static readonly KV_KEYS = ['categoria', 'cat', 'negocio', 'comercio', 'fecha', 'tag', 'etiqueta'];

  private extractKeyValue(text: string, keys: string[]): string | undefined {
    for (const key of keys) {
      const pattern = new RegExp(
        `\\b${key}\\s*:\\s*(.+?)(?=\\s+(?:${WhatsappMessageParser.KV_KEYS.join('|')})\\s*:|$)`,
        'i',
      );
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private extractDate(text: string): string | undefined {
    const raw = this.extractKeyValue(text, ['fecha']);
    if (!raw) return undefined;

    const now = new Date();
    let day: number, month: number, year: number = now.getFullYear();

    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      year = parseInt(iso[1], 10);
      month = parseInt(iso[2], 10);
      day = parseInt(iso[3], 10);
    } else {
      const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (dmy) {
        day = parseInt(dmy[1], 10);
        month = parseInt(dmy[2], 10);
        if (dmy[3]) {
          year = parseInt(dmy[3], 10);
          if (year < 100) year += 2000;
        }
      } else {
        return undefined;
      }
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return undefined;
    if (date > now) return undefined;

    return date.toISOString();
  }

  private stripKeyValues(text: string): string {
    return text.replace(
      new RegExp(
        `\\b(?:${WhatsappMessageParser.KV_KEYS.join('|')})\\s*:\\s*.+?(?=\\s+(?:${WhatsappMessageParser.KV_KEYS.join('|')})\\s*:|$)`,
        'gi',
      ),
      '',
    ).trim();
  }
}
