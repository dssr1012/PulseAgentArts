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
      // Dynamic import for pdf-parse
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text;

      return this.extractDataFromText(text);
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      throw new Error(`Failed to parse PDF statement: ${error.message}`);
    }
  }

  private extractDataFromText(text: string): ParsedStatement {
    // Extract dates
    const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
    const dates = [...text.matchAll(datePattern)].map((m) => {
      const [day, month, year] = m[1].split('/');
      return new Date(`${year}-${month}-${day}`);
    });

    // Extract amounts (look for patterns like $1,234.56 or 1234,56)
    const amountPattern = /\$?\s*([\d.,]+)/g;
    const amounts = [...text.matchAll(amountPattern)]
      .map((m) => parseFloat(m[1].replace(/[.,](?=\d{3})/g, '').replace(',', '.')))
      .filter((n) => !isNaN(n) && n > 0);

    // Extract line items
    const lines = text.split('\n').filter((l) => l.trim());
    const items = this.extractLineItems(lines);

    // Determine closing and due dates
    const closingDate = dates.length > 0 ? dates[0] : new Date();
    const dueDate = dates.length > 1 ? dates[1] : new Date();

    // Determine totals
    const totalAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const minPayment = amounts.length > 1
      ? amounts.sort((a, b) => a - b).find((a) => a > 0 && a < totalAmount) || 0
      : 0;

    return {
      closingDate,
      dueDate,
      totalAmount,
      minPayment,
      currency: 'ARS', // Default, can be overridden
      items,
    };
  }

  private extractLineItems(lines: string[]): any[] {
    const items: any[] = [];
    const itemPattern = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d.,]+)/;

    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match) {
        const [_, dateStr, description, amountStr] = match;
        const [day, month, year] = dateStr.split('/');
        items.push({
          date: new Date(`${year}-${month}-${day}`),
          description: description.trim(),
          amount: parseFloat(amountStr.replace(',', '.')),
          currency: 'ARS',
        });
      }
    }

    return items;
  }
}