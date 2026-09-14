import { Injectable, Logger } from '@nestjs/common';

export interface ParsedExpenseMessage {
  amount: number;
  description: string;
  currency: 'ARS' | 'USD' | 'EUR';
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
    const normalized = text.trim().toLowerCase();
    if (!normalized) return null;

    const amount = this.extractAmount(normalized);
    if (amount === null || amount <= 0) return null;

    const description = this.extractDescription(text.trim(), amount);
    const currency = this.extractCurrency(normalized);

    return { amount, description, currency };
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
    desc = desc.trim();

    if (!desc) desc = 'Gasto WhatsApp';
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  private extractCurrency(text: string): 'ARS' | 'USD' | 'EUR' {
    if (/\b(usd|dolares|dólares|\$us|u\$s)\b/.test(text)) return 'USD';
    if (/\b(eur|euros|€)\b/.test(text)) return 'EUR';
    return 'ARS';
  }
}
