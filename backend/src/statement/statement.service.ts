import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { PdfStatementParser } from './parsers/pdf-statement.parser';
import { StatementPasswordCrypto } from '../common/statement-password.crypto';
import { AnomalyService } from '../anomaly/anomaly.service';
import { ConfirmStatementDto } from './dto/statement.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfParser: PdfStatementParser,
    private passwordCrypto: StatementPasswordCrypto,
    private anomalyService: AnomalyService,
  ) {}

  async uploadAndParse(
    cardId: string,
    circleId: string,
    file: Express.Multer.File,
    password?: string,
  ) {
    // Validate card exists in circle
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, groupId: circleId },
    });

    if (!card) {
      throw new NotFoundException({
        errorCode: 'CARD_NOT_FOUND',
        message: 'Credit card not found',
      });
    }

    // Validate file format
    const allowedMimes = ['application/pdf', 'text/plain'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException({
        errorCode: 'STMT_UNSUPPORTED_FORMAT',
        message: 'Only PDF and plain text files are supported',
      });
    }

    // Validate file size
    const maxSize = this.config.get<number>('STATEMENT_MAX_SIZE_MB', 10) * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException({
        errorCode: 'STMT_FILE_TOO_LARGE',
        message: `File size exceeds maximum of ${this.config.get<number>('STATEMENT_MAX_SIZE_MB', 10)}MB`,
      });
    }

    try {
      // Parse the statement
      let parsed;
      if (file.mimetype === 'text/plain') {
        const text = file.buffer.toString('utf-8');
        parsed = this.pdfParser.parseText(text);
      } else {
        // Build password candidates: user-provided first, then stored card password
        const passwordsToTry: string[] = [];
        if (password) passwordsToTry.push(password);
        if (card.statementPassword) {
          const decrypted = this.passwordCrypto.decrypt(card.statementPassword);
          if (decrypted && !passwordsToTry.includes(decrypted)) {
            passwordsToTry.push(decrypted);
          }
        }
        parsed = await this.pdfParser.parse(file.buffer, passwordsToTry);
      }

      // If a password was provided and worked, store it on the card for next time
      if (password && file.mimetype === 'application/pdf') {
        const encrypted = this.passwordCrypto.encrypt(password);
        await this.prisma.creditCard.update({
          where: { id: cardId },
          data: { statementPassword: encrypted },
        });
      }

      // Check for duplicate statement (same card + same closing date)
      const closeDate = parsed.closingDate;
      const dayStart = new Date(closeDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(closeDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await this.prisma.cardStatement.findFirst({
        where: {
          cardId,
          closeDate: { gte: dayStart, lte: dayEnd },
        },
      });

      if (existing) {
        throw new ConflictException({
          errorCode: 'STMT_ALREADY_UPLOADED',
          message: `A statement with closing date ${closeDate.toLocaleDateString()} has already been uploaded for this card.`,
        });
      }

      // Store file temporarily
      const tempDir = this.config.get<string>('STATEMENT_TEMP_DIR', './uploads/statements');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const previewId = crypto.randomUUID();
      const filePath = path.join(tempDir, `${previewId}.pdf`);
      fs.writeFileSync(filePath, file.buffer);

      // Create statement record
      const statement = await this.prisma.cardStatement.create({
        data: {
          id: previewId,
          cardId,
          closeDate: parsed.closingDate,
          dueDate: parsed.dueDate,
          totalAmount: parsed.totalAmount,
          minPayment: parsed.minPayment,
          currency: parsed.currency as any,
          filePath,
        },
      });

      // Create statement items
      if (parsed.items.length > 0) {
        await this.prisma.statementItem.createMany({
          data: parsed.items.map((item) => ({
            statementId: statement.id,
            date: item.date,
            description: item.description,
            amount: item.amount,
            currency: item.currency as any,
          })),
        });
      }

      return {
        previewId: statement.id,
        closingDate: parsed.closingDate.toISOString(),
        dueDate: parsed.dueDate.toISOString(),
        totalAmount: parsed.totalAmount,
        minPayment: parsed.minPayment,
        currency: parsed.currency,
        items: parsed.items.map((item) => ({
          date: item.date.toISOString(),
          description: item.description,
          amount: item.amount,
          currency: item.currency,
        })),
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Statement parsing failed: ${error.message}`);
      if (error.message && error.message.includes('password-protected')) {
        throw new BadRequestException({
          errorCode: 'STMT_PASSWORD_REQUIRED',
          message: 'This PDF is password-protected. Please enter the statement password.',
        });
      }
      throw new BadRequestException({
        errorCode: 'STMT_PARSE_FAILED',
        message: 'Failed to parse the statement file',
      });
    }
  }

  async confirmStatement(
    previewId: string,
    userId: string,
    circleId: string,
    dto?: ConfirmStatementDto,
  ) {
    const statement = await this.prisma.cardStatement.findUnique({
      where: { id: previewId },
      include: { items: true },
    });

    if (!statement) {
      throw new NotFoundException({
        errorCode: 'STMT_PREVIEW_NOT_FOUND',
        message: 'Statement preview not found',
      });
    }

    if (statement.isConfirmed) {
      throw new ConflictException({
        errorCode: 'STMT_ALREADY_CONFIRMED',
        message: 'This statement has already been confirmed',
      });
    }

    // Use provided items or original parsed items
    const items = dto?.items || statement.items.map((item) => ({
      date: item.date.toISOString(),
      description: item.description,
      amount: Number(item.amount),
      currency: item.currency,
    }));

    // Get the first category for statement expenses
    const defaultCategory = await this.prisma.category.findFirst({
      where: { groupId: circleId, isDefault: true },
    });

    // Create expense records from items
    const createdExpenseIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Mark statement as confirmed
      await tx.cardStatement.update({
        where: { id: previewId },
        data: { isConfirmed: true },
      });

      // Create expenses from items
      for (const item of items) {
        const expense = await tx.transaction.create({
          data: {
            groupId: circleId,
            userId,
            type: 'expense',
            amount: item.amount,
            currency: item.currency as any,
            categoryId: defaultCategory?.id || '',
            description: item.description,
            source: 'statement',
            confirmationStatus: 'confirmed',
            transactionDate: new Date(item.date),
          },
        });
        createdExpenseIds.push(expense.id);
      }
    });

    // Purge temp file
    if (statement.filePath) {
      try {
        fs.unlinkSync(statement.filePath);
      } catch {
        this.logger.warn(`Failed to purge temp file: ${statement.filePath}`);
      }
    }

    // Trigger anomaly detection so unmatched charges appear immediately
    try {
      await this.anomalyService.detectAnomaliesForCircle(circleId);
    } catch (err) {
      this.logger.warn(`Anomaly detection failed after statement confirm: ${err.message}`);
    }

    return { createdExpenseIds };
  }

  async listStatements(cardId: string, circleId: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, groupId: circleId },
    });
    if (!card) {
      throw new NotFoundException({
        errorCode: 'CARD_NOT_FOUND',
        message: 'Credit card not found',
      });
    }

    const statements = await this.prisma.cardStatement.findMany({
      where: { cardId },
      include: {
        items: true,
      },
      orderBy: { closeDate: 'desc' },
    });

    return statements.map((s) => ({
      id: s.id,
      cardId: s.cardId,
      closeDate: s.closeDate.toISOString(),
      dueDate: s.dueDate.toISOString(),
      totalAmount: Number(s.totalAmount),
      minPayment: Number(s.minPayment),
      currency: s.currency,
      isConfirmed: s.isConfirmed,
      createdAt: s.createdAt.toISOString(),
      items: s.items.map((item) => ({
        id: item.id,
        date: item.date.toISOString(),
        description: item.description,
        amount: Number(item.amount),
        currency: item.currency,
        matchedTransactionId: item.matchedTransactionId,
      })),
    }));
  }
}