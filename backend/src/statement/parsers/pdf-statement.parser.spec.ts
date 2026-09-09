import { PdfStatementParser } from './pdf-statement.parser';

describe('PdfStatementParser', () => {
  let parser: PdfStatementParser;

  beforeEach(() => {
    parser = new PdfStatementParser();
  });

  describe('parse', () => {
    it('should extract structured data from a PDF buffer', async () => {
      // Mock pdf-parse module
      jest.doMock('pdf-parse', () => {
        return jest.fn().mockResolvedValue({
          text: `
            Estado de Cuenta
            31/01/2026  15/02/2026
            Total: $50,000.00
            Minimo: $5,000.00
            15/01/2026  Supermarket X  5000.00
            20/01/2026  Gas Station  3000.00
          `,
        });
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
      jest.doMock('pdf-parse', () => {
        return jest.fn().mockResolvedValue({
          text: `
            15/01/2026  Supermarket X  5000.00
            20/01/2026  Gas Station  3000.00
          `,
        });
      });

      const result = await parser.parse(Buffer.from('fake-pdf'));

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should throw error for unparseable PDF', async () => {
      jest.doMock('pdf-parse', () => {
        return jest.fn().mockRejectedValue(new Error('Invalid PDF'));
      });

      await expect(parser.parse(Buffer.from('invalid'))).rejects.toThrow();
    });

    it('should default to ARS currency', async () => {
      jest.doMock('pdf-parse', () => {
        return jest.fn().mockResolvedValue({
          text: '31/01/2026  15/02/2026  $1000.00',
        });
      });

      const result = await parser.parse(Buffer.from('fake-pdf'));

      expect(result.currency).toBe('ARS');
    });
  });
});