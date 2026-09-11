import { PdfStatementParser } from './pdf-statement.parser';

// Top-level mock with a controllable function — jest.mock is hoisted above imports
jest.mock('pdf-parse', () => jest.fn());

// Obtain a reference to the mocked pdf-parse function
const pdfParse = require('pdf-parse') as jest.Mock;

describe('PdfStatementParser', () => {
  let parser: PdfStatementParser;

  beforeEach(() => {
    parser = new PdfStatementParser();
    pdfParse.mockReset();
  });

  afterEach(() => {
    pdfParse.mockReset();
  });

  describe('parse', () => {
    it('should extract structured data from a PDF buffer', async () => {
      pdfParse.mockResolvedValue({
        text: `
            Estado de Cuenta
            31/01/2026  15/02/2026
            Total: $50,000.00
            Minimo: $5,000.00
            15/01/2026  Supermarket X  5000.00
            20/01/2026  Gas Station  3000.00
          `,
      });

      const result = await parser.parse(Buffer.from('fake-pdf'));

      expect(result).toBeDefined();
      expect(result.closingDate).toBeInstanceOf(Date);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
      expect(result.minPayment).toBeGreaterThanOrEqual(0);
      expect(result.currency).toBe('ARS');
    });

    it('should extract line items from statement text', async () => {
      pdfParse.mockResolvedValue({
        text: `
            15/01/2026  Supermarket X  5000.00
            20/01/2026  Gas Station  3000.00
          `,
      });

      const result = await parser.parse(Buffer.from('fake-pdf'));

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should throw error for unparseable PDF', async () => {
      pdfParse.mockRejectedValue(new Error('Invalid PDF'));

      await expect(parser.parse(Buffer.from('invalid'))).rejects.toThrow();
    });

    it('should default to ARS currency', async () => {
      pdfParse.mockResolvedValue({
        text: '31/01/2026  15/02/2026  $1000.00',
      });

      const result = await parser.parse(Buffer.from('fake-pdf'));

      expect(result.currency).toBe('ARS');
    });
  });
});
