import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedStatement,
  IStatementParser,
} from './statement-parser.interface';

@Injectable()
export class PdfStatementParser implements IStatementParser {
  private readonly logger = new Logger(PdfStatementParser.name);

  async parse(fileBuffer: Buffer): Promise<ParsedStatement> {
    try {
      let text: string;

      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        text = pdfData.text;
      } catch (err) {
        if (err.message && (err.message.includes('password') || err.message.includes('Password'))) {
          this.logger.warn('PDF appears encrypted, retrying with empty password');
          text = await this.extractTextWithPassword(fileBuffer, '');
        } else {
          throw err;
        }
      }

      this.logger.debug(`Extracted ${text.length} chars of text from PDF`);
      return this.extractDataFromText(text);
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      if (error.message && error.message.includes('password-protected')) {
        throw new Error('PDF is password-protected. Please remove the password and try again.');
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

    doc.destroy();
    return text;
  }

  private extractDataFromText(text: string): ParsedStatement {
    const lines = text.split('\n').filter((l) => l.trim());

    const dates = this.extractDates(text);
    const amounts = this.extractAmounts(text);
    const items = this.extractLineItems(lines);

    const closingDate = dates.length > 0 ? dates[0] : new Date();
    const dueDate = dates.length > 1 ? dates[1] : new Date();

    const totalAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const minPayment = amounts.length > 1
      ? amounts.sort((a, b) => a - b).find((a) => a > 0 && a < totalAmount) || 0
      : 0;

    return {
      closingDate,
      dueDate,
      totalAmount,
      minPayment,
      currency: 'ARS',
      items,
    };
  }

  private extractDates(text: string): Date[] {
    const patterns = [
      /(\d{2})\/(\d{2})\/(\d{4})/g,
      /(\d{2})-(\d{2})-(\d{4})/g,
      /(\d{2})\.(\d{2})\.(\d{4})/g,
      /(\d{4})-(\d{2})-(\d{2})/g,
    ];
    const dates: Date[] = [];
    for (const pattern of patterns) {
      for (const m of text.matchAll(pattern)) {
        let day: string, month: string, year: string;
        if (m[1].length === 4) {
          year = m[1]; month = m[2]; day = m[3];
        } else {
          day = m[1]; month = m[2]; year = m[3];
        }
        const d = new Date(`${year}-${month}-${day}`);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    }
    return dates;
  }

  private extractAmounts(text: string): number[] {
    const amountPattern = /\$\s*([\d.,]+)/g;
    const amounts: number[] = [];
    for (const m of text.matchAll(amountPattern)) {
      const raw = m[1];
      const parsed = this.parseAmount(raw);
      if (parsed !== null && parsed > 0) amounts.push(parsed);
    }
    return amounts;
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
    const itemPatterns = [
      /(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+([\d.,]+)$/,
      /(\d{2})-(\d{2})-(\d{4})\s+(.+?)\s+([\d.,]+)$/,
      /(\d{2})\.(\d{2})\.(\d{4})\s+(.+?)\s+([\d.,]+)$/,
    ];

    for (const line of lines) {
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          const [, day, month, year, description, amountStr] = match;
          const amount = this.parseAmount(amountStr);
          if (amount !== null) {
            items.push({
              date: new Date(`${year}-${month}-${day}`),
              description: description.trim(),
              amount,
              currency: 'ARS',
            });
            break;
          }
        }
      }
    }

    return items;
  }
}
