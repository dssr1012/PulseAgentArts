import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedStatement,
  IStatementParser,
} from './statement-parser.interface';

@Injectable()
export class PdfStatementParser implements IStatementParser {
  private readonly logger = new Logger(PdfStatementParser.name);

  async parse(fileBuffer: Buffer, passwords: string[] = []): Promise<ParsedStatement> {
    try {
      let text = '';

      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        text = pdfData.text;
      } catch (err) {
        if (err.message && (err.message.includes('password') || err.message.includes('Password'))) {
          this.logger.warn(`PDF appears encrypted, trying ${passwords.length} password(s) + empty fallback`);
          const candidates = [...passwords, ''];
          let extracted = false;
          for (const pw of candidates) {
            try {
              text = await this.extractTextWithPassword(fileBuffer, pw);
              extracted = true;
              break;
            } catch {
              // try next password
            }
          }
          if (!extracted) {
            throw new Error('PDF is password-protected');
          }
        } else {
          throw err;
        }
      }

      this.logger.debug(`Extracted ${text.length} chars of text from PDF`);
      return this.extractDataFromText(text);
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      if (error.message && error.message.includes('password-protected')) {
        throw new Error('PDF is password-protected');
      }
      throw new Error(`Failed to parse PDF statement: ${error.message}`);
    }
  }

  parseText(text: string): ParsedStatement {
    return this.extractDataFromText(text);
  }

  private async extractTextWithPassword(fileBuffer: Buffer, password: string): Promise<string> {
    const pdfjsPath = require.resolve('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
    const PDFJS = require(pdfjsPath);
    PDFJS.disableWorker = true;

    const doc = await PDFJS.getDocument({ data: new Uint8Array(fileBuffer), password });
    let text = '';

    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let lastY: number | undefined;
        let pageText = '';
        for (const item of content.items) {
          if (lastY === item.transform[5] || lastY === undefined) {
            pageText += item.str;
          } else {
            pageText += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        text += pageText + '\n\n';
      }
    } finally {
      await doc.destroy();
    }

    return text;
  }

  private extractDataFromText(text: string): ParsedStatement {
    const lines = text.split('\n').filter((l) => l.trim());

    const closingDate = this.extractClosingDate(text);
    const dueDate = this.extractDueDate(text);
    const totalAmount = this.extractTotalAmount(text);
    const minPayment = this.extractMinPayment(text);
    const items = this.extractLineItems(lines);
    const creditLimit = this.extractCreditLimit(text);
    const financingRate = this.extractFinancingRate(text);

    return {
      closingDate,
      dueDate,
      totalAmount,
      minPayment,
      currency: 'ARS',
      items,
      creditLimit,
      financingRate,
    };
  }

  private readonly MONTHS: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  };

  private parseSpanishDate(dayStr: string, monStr: string, yearStr: string): Date | null {
    const day = parseInt(dayStr, 10);
    const month = this.MONTHS[monStr.toLowerCase().slice(0, 3)];
    const year = 2000 + parseInt(yearStr, 10);
    if (isNaN(day) || month === undefined || isNaN(year)) return null;
    return new Date(Date.UTC(year, month, day));
  }

  private extractClosingDate(text: string): Date {
    const m = text.match(/CIERRE ACTUAL:\s*(\d{1,2})\s+(\w{3})\s+(\d{2})/);
    if (m) {
      const d = this.parseSpanishDate(m[1], m[2], m[3]);
      if (d) return d;
    }
    return new Date();
  }

  private extractDueDate(text: string): Date {
    const m = text.match(/VENCIMIENTO[^]*?(\d{1,2})\s+(\w{3})\s+(\d{2})/);
    if (m) {
      const d = this.parseSpanishDate(m[1], m[2], m[3]);
      if (d) return d;
    }
    return new Date();
  }

  private extractTotalAmount(text: string): number {
    const m = text.match(/SALDO ACTUAL\s*\$\s*([\d.,]+)/);
    if (m) {
      const amt = this.parseAmount(m[1]);
      if (amt !== null) return amt;
    }
    return 0;
  }

  private extractMinPayment(text: string): number {
    const m = text.match(/PAGO MINIMO\s*\$\s*([\d.,]+)/);
    if (m) {
      const amt = this.parseAmount(m[1]);
      if (amt !== null) return amt;
    }
    return 0;
  }

  private extractCreditLimit(text: string): number | undefined {
    // Try "LIMITES DE CONSUMO" or "LIMITE" patterns
    const patterns = [
      /LIMITES?\s*(?:DE\s*CONSUMO)?\s*:?\s*\$\s*([\d.,]+)/i,
      /LIMITE\s+(?:DE\s+)?(?:CREDITO|CONSUMO)\s*:?\s*\$\s*([\d.,]+)/i,
      /MONTO\s+MAXIMO\s*:?\s*\$\s*([\d.,]+)/i,
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) {
        const amt = this.parseAmount(m[1]);
        if (amt !== null && amt > 0) return amt;
      }
    }
    return undefined;
  }

  private extractFinancingRate(text: string): number | undefined {
    // Try TNA (Tasa Nominal Anual) patterns
    const patterns = [
      /TNA\s*:?\s*([\d.,]+)\s*%/i,
      /TASA\s+NOMINAL\s+ANUAL\s*:?\s*([\d.,]+)\s*%/i,
      /TASA\s+DE\s+INTERES\s*:?\s*([\d.,]+)\s*%/i,
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) {
        const rate = this.parseAmount(m[1]);
        if (rate !== null && rate > 0) return rate;
      }
    }
    return undefined;
  }

  private parseAmount(raw: string): number | null {
    let cleaned = raw.trim();
    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    if (hasDot && hasComma) {
      if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      }
    } else if (hasComma) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = parts[0] + '.' + parts[1];
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  private extractLineItems(lines: string[]): any[] {
    const items: any[] = [];
    const datePattern = /(\d{2})\.(\d{2})\.(\d{2})/;
    const skipPatterns = /^(SALDO|PAGO|LIMITES|FECHA|COMPROBANTE|DETALLE|TNA|TEM|CFT|VTO|CIERRE|VENCIMIENTO|Costo|La tasa|Los intereses|Si |Le informamos|Recuerde|Orientaci|De conformidad|Abone|USTED|Por seguridad|Lectura)/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (skipPatterns.test(trimmed)) continue;

      const dateMatch = trimmed.match(datePattern);
      if (!dateMatch) continue;

      if (/\bTNA\b\s+\d{8,}/i.test(trimmed)) continue;

      const day = dateMatch[1];
      const month = dateMatch[2];
      const year = dateMatch[3];
      const fullYear = 2000 + parseInt(year, 10);

      const afterDate = trimmed.slice(dateMatch.index! + dateMatch[0].length);

      const parts = afterDate.split(/\s{2,}/).filter((p) => p.trim());
      if (parts.length < 2) continue;

      const amountParts: number[] = [];
      let firstAmountIdx = -1;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (/^[\d.,]+$/.test(p) && !p.endsWith('%')) {
          if (/^\d{10,}$/.test(p)) continue;
          const amt = this.parseAmount(p);
          if (amt !== null) {
            if (firstAmountIdx === -1) firstAmountIdx = i;
            amountParts.push(amt);
          }
        }
      }

      if (firstAmountIdx === -1 || amountParts.length === 0) continue;
      const pesos = amountParts[0];
      if (pesos === 0) continue;

      const descParts = parts.slice(0, firstAmountIdx);
      let description = descParts.join(' ').trim();
      description = description.replace(/\s+\$$/, '').replace(/\$$/, '').trim();
      if (!description) continue;

      const cuotaMatch = description.match(/Cuota\s+(\d+)\s*\/\s*(\d+)/i);
      const installmentNumber = cuotaMatch ? parseInt(cuotaMatch[1], 10) : undefined;
      const totalInstallments = cuotaMatch ? parseInt(cuotaMatch[2], 10) : undefined;

      items.push({
        date: new Date(Date.UTC(fullYear, parseInt(month, 10) - 1, parseInt(day, 10))),
        description,
        amount: pesos,
        currency: 'ARS',
        installmentNumber,
        totalInstallments,
      });
    }

    return items;
  }
}
