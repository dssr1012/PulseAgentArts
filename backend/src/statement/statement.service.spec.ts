import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { StatementService } from './statement.service';
import { PrismaService } from '../common/prisma.service';
import { PdfStatementParser } from './parsers/pdf-statement.parser';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/tmp/test-preview.pdf'),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('preview-uuid-1'),
}));

describe('StatementService', () => {
  let service: StatementService;
  let prisma: jest.Mocked<PrismaService>;
  let pdfParser: jest.Mocked<PdfStatementParser>;
  let config: jest.Mocked<ConfigService>;

  const mockCard = {
    id: 'card-1',
    groupId: 'circle-1',
    bankName: 'Santander',
    cardType: 'Visa',
    lastFourDigits: '1234',
  };

  const mockParsedStatement = {
    closingDate: new Date('2026-01-31'),
    dueDate: new Date('2026-02-15'),
    totalAmount: 50000,
    minPayment: 5000,
    currency: 'ARS',
    items: [
      {
        date: new Date('2026-01-15'),
        description: 'Supermarket X',
        amount: 5000,
        currency: 'ARS',
      },
      {
        date: new Date('2026-01-20'),
        description: 'Gas Station',
        amount: 3000,
        currency: 'ARS',
      },
    ],
  };

  const mockFile = {
    buffer: Buffer.from('fake-pdf-content'),
    mimetype: 'application/pdf',
    size: 1024 * 1024, // 1MB
    originalname: 'statement.pdf',
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementService,
        {
          provide: PrismaService,
          useValue: {
            creditCard: {
              findFirst: jest.fn(),
            },
            cardStatement: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            statementItem: {
              createMany: jest.fn(),
              update: jest.fn(),
            },
            category: {
              findFirst: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                STATEMENT_MAX_SIZE_MB: 10,
                STATEMENT_TEMP_DIR: './uploads/statements',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: PdfStatementParser,
          useValue: {
            parse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StatementService>(StatementService);
    prisma = module.get(PrismaService);
    pdfParser = module.get(PdfStatementParser);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Upload and Parse ────────────────────────────────────────────

  describe('uploadAndParse', () => {
    it('should parse a valid PDF statement', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);
      (pdfParser.parse as jest.Mock).mockResolvedValue(mockParsedStatement);
      (prisma.cardStatement.create as jest.Mock).mockResolvedValue({
        id: 'preview-uuid-1',
        cardId: 'card-1',
      });
      (prisma.statementItem.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await service.uploadAndParse('card-1', 'circle-1', mockFile);

      expect(result.previewId).toBe('preview-uuid-1');
      expect(result.totalAmount).toBe(50000);
      expect(result.items).toHaveLength(2);
    });

    it('should throw NotFoundException for non-existent card', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.uploadAndParse('card-99', 'circle-1', mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for unsupported file format', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);

      const unsupportedFile = {
        ...mockFile,
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(
        service.uploadAndParse('card-1', 'circle-1', unsupportedFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept PDF files', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);
      (pdfParser.parse as jest.Mock).mockResolvedValue(mockParsedStatement);
      (prisma.cardStatement.create as jest.Mock).mockResolvedValue({ id: 'preview-1' });
      (prisma.statementItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });

      await service.uploadAndParse('card-1', 'circle-1', mockFile);

      expect(pdfParser.parse).toHaveBeenCalled();
    });

    it('should accept plain text files', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);
      (pdfParser.parse as jest.Mock).mockResolvedValue(mockParsedStatement);
      (prisma.cardStatement.create as jest.Mock).mockResolvedValue({ id: 'preview-1' });
      (prisma.statementItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });

      const textFile = {
        ...mockFile,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await service.uploadAndParse('card-1', 'circle-1', textFile);

      expect(pdfParser.parse).toHaveBeenCalled();
    });

    it('should throw BadRequestException for file exceeding 10MB', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);

      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      } as Express.Multer.File;

      await expect(
        service.uploadAndParse('card-1', 'circle-1', largeFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parsing fails', async () => {
      (prisma.creditCard.findFirst as jest.Mock).mockResolvedValue(mockCard);
      (pdfParser.parse as jest.Mock).mockRejectedValue(new Error('Parse error'));

      await expect(
        service.uploadAndParse('card-1', 'circle-1', mockFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Confirm Statement ───────────────────────────────────────────

  describe('confirmStatement', () => {
    const mockStatement = {
      id: 'preview-1',
      cardId: 'card-1',
      isConfirmed: false,
      filePath: '/tmp/test-preview.pdf',
      items: [
        {
          id: 'item-1',
          date: new Date('2026-01-15'),
          description: 'Supermarket X',
          amount: 5000,
          currency: 'ARS',
        },
      ],
    };

    it('should create expense records from statement items', async () => {
      (prisma.cardStatement.findUnique as jest.Mock).mockResolvedValue(mockStatement);
      (prisma.category.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        isDefault: true,
      });
      (prisma.cardStatement.update as jest.Mock).mockResolvedValue({
        ...mockStatement,
        isConfirmed: true,
      });
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

      const result = await service.confirmStatement(
        'preview-1',
        'user-1',
        'circle-1',
      );

      expect(result.createdExpenseIds).toContain('tx-1');
    });

    it('should throw NotFoundException for non-existent preview', async () => {
      (prisma.cardStatement.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.confirmStatement('preview-99', 'user-1', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for already confirmed statement', async () => {
      (prisma.cardStatement.findUnique as jest.Mock).mockResolvedValue({
        ...mockStatement,
        isConfirmed: true,
      });

      await expect(
        service.confirmStatement('preview-1', 'user-1', 'circle-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should purge temp file after confirmation', async () => {
      (prisma.cardStatement.findUnique as jest.Mock).mockResolvedValue(mockStatement);
      (prisma.category.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        isDefault: true,
      });
      (prisma.cardStatement.update as jest.Mock).mockResolvedValue({
        ...mockStatement,
        isConfirmed: true,
      });
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

      const fs = require('fs');
      await service.confirmStatement('preview-1', 'user-1', 'circle-1');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test-preview.pdf');
    });

    it('should use user-modified items if provided', async () => {
      (prisma.cardStatement.findUnique as jest.Mock).mockResolvedValue(mockStatement);
      (prisma.category.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        isDefault: true,
      });
      (prisma.cardStatement.update as jest.Mock).mockResolvedValue({
        ...mockStatement,
        isConfirmed: true,
      });
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx-2' });

      const modifiedItems = [
        {
          date: '2026-01-15T00:00:00Z',
          description: 'Modified Item',
          amount: 6000,
          currency: 'ARS',
        },
      ];

      await service.confirmStatement('preview-1', 'user-1', 'circle-1', {
        items: modifiedItems,
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Modified Item',
            amount: 6000,
          }),
        }),
      );
    });
  });
});