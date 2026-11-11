import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { PdfStatementParser } from './parsers/pdf-statement.parser';
import { StatementPasswordCrypto } from '../common/statement-password.crypto';
import { AnomalyService } from '../anomaly/anomaly.service';
import { AcceptItemsDto, ReportFraudDto } from './dto/statement.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const MATCH_DATE_TOLERANCE_DAYS = 3;
const MATCH_AMOUNT_TOLERANCE = 0.01;

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
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, groupId: circleId },
    });

    if (!card) {
      throw new NotFoundException({
        errorCode: 'CARD_NOT_FOUND',
        message: 'Credit card not found',
      });
    }

    if (!file) {
      throw new BadRequestException({
        errorCode: 'STMT_NO_FILE',
        message: 'No file uploaded',
      });
    }

    const allowedMimes = ['application/pdf', 'text/plain'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException({
        errorCode: 'STMT_UNSUPPORTED_FORMAT',
        message: 'Only PDF and plain text files are supported',
      });
    }

    const maxSize = this.config.get<number>('STATEMENT_MAX_SIZE_MB', 10) * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException({
        errorCode: 'STMT_FILE_TOO_LARGE',
        message: `File size exceeds maximum of ${this.config.get<number>('STATEMENT_MAX_SIZE_MB', 10)}MB`,
      });
    }

    let tempFilePath: string | null = null;

    try {
      let parsed;
      if (file.mimetype === 'text/plain') {
        const text = file.buffer.toString('utf-8');
        parsed = this.pdfParser.parseText(text);
      } else {
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

      if (password && file.mimetype === 'application/pdf') {
        const encrypted = this.passwordCrypto.encrypt(password);
        await this.prisma.creditCard.update({
          where: { id: cardId },
          data: { statementPassword: encrypted },
        });
      }

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
        if (existing.isConfirmed) {
          throw new ConflictException({
            errorCode: 'STMT_ALREADY_UPLOADED',
            message: `A statement with closing date ${closeDate.toLocaleDateString()} has already been confirmed for this card.`,
          });
        }
        await this.prisma.statementItem.deleteMany({
          where: { statementId: existing.id },
        });
        await this.prisma.cardStatement.delete({
          where: { id: existing.id },
        });
        if (existing.filePath) {
          try { fs.unlinkSync(existing.filePath); } catch { }
        }
      }

      const tempDir = this.config.get<string>('STATEMENT_TEMP_DIR', './uploads/statements');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const previewId = crypto.randomUUID();
      const filePath = path.join(tempDir, `${previewId}.pdf`);
      fs.writeFileSync(filePath, file.buffer);
      tempFilePath = filePath;

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
      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); } catch { }
      }
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

  async reconcileStatement(previewId: string, circleId: string) {
    const statement = await this.prisma.cardStatement.findUnique({
      where: { id: previewId },
      include: {
        card: true,
        items: true,
      },
    });

    if (!statement) {
      throw new NotFoundException({
        errorCode: 'STMT_PREVIEW_NOT_FOUND',
        message: 'Statement not found',
      });
    }

    if (statement.card.groupId !== circleId) {
      throw new ForbiddenException({
        errorCode: 'STMT_PERMISSION_DENIED',
        message: 'Statement not found',
      });
    }

    const existingExpenses = await this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        type: 'expense',
        confirmationStatus: 'confirmed',
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        transactionDate: true,
        description: true,
        categoryId: true,
        paymentMethod: true,
        cardId: true,
        source: true,
      },
    });

    const alreadyLinkedExpenseIds = new Set(
      (await this.prisma.statementItem.findMany({
        where: { matchedTransactionId: { not: null } },
        select: { matchedTransactionId: true },
      })).map((si) => si.matchedTransactionId!),
    );

    const reconciledItems = statement.items.map((item) => {
      const itemDate = new Date(item.date);
      const itemAmount = Number(item.amount);

      let bestMatch: typeof existingExpenses[0] | null = null;
      let bestDateDist = Infinity;

      for (const expense of existingExpenses) {
        if (alreadyLinkedExpenseIds.has(expense.id)) continue;
        if (expense.currency !== item.currency) continue;

        const amountDiff = Math.abs(Number(expense.amount) - itemAmount);
        if (amountDiff > MATCH_AMOUNT_TOLERANCE) continue;

        const dateDiffMs = Math.abs(
          new Date(expense.transactionDate).getTime() - itemDate.getTime(),
        );
        const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
        if (dateDiffDays > MATCH_DATE_TOLERANCE_DAYS) continue;

        if (dateDiffDays < bestDateDist) {
          bestDateDist = dateDiffDays;
          bestMatch = expense;
        }
      }

      return {
        id: item.id,
        date: item.date.toISOString(),
        description: item.description,
        amount: itemAmount,
        currency: item.currency,
        matched: bestMatch !== null,
        matchedExpense: bestMatch
          ? {
              id: bestMatch.id,
              description: bestMatch.description,
              amount: Number(bestMatch.amount),
              transactionDate: bestMatch.transactionDate.toISOString(),
              paymentMethod: bestMatch.paymentMethod,
              source: bestMatch.source,
            }
          : null,
      };
    });

    const matchedCount = reconciledItems.filter((i) => i.matched).length;
    const unmatchedCount = reconciledItems.length - matchedCount;

    return {
      previewId: statement.id,
      cardId: statement.cardId,
      cardLastFour: statement.card.lastFourDigits,
      cardBank: statement.card.bankName,
      closingDate: statement.closeDate.toISOString(),
      dueDate: statement.dueDate.toISOString(),
      totalAmount: Number(statement.totalAmount),
      minPayment: Number(statement.minPayment),
      currency: statement.currency,
      isConfirmed: statement.isConfirmed,
      items: reconciledItems,
      summary: {
        total: reconciledItems.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
      },
    };
  }

  async acceptItems(
    previewId: string,
    userId: string,
    circleId: string,
    dto: AcceptItemsDto,
  ) {
    const statement = await this.prisma.cardStatement.findUnique({
      where: { id: previewId },
      include: { card: true, items: true },
    });

    if (!statement) {
      throw new NotFoundException({
        errorCode: 'STMT_PREVIEW_NOT_FOUND',
        message: 'Statement not found',
      });
    }

    if (statement.card.groupId !== circleId) {
      throw new ForbiddenException({
        errorCode: 'STMT_PERMISSION_DENIED',
        message: 'Statement not found',
      });
    }

    if (statement.isConfirmed) {
      throw new ConflictException({
        errorCode: 'STMT_ALREADY_CONFIRMED',
        message: 'This statement has already been confirmed',
      });
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException({
        errorCode: 'STMT_NO_ITEMS_SELECTED',
        message: 'No items selected to add as expenses',
      });
    }

    const statementItemIds = dto.items.map((i) => i.statementItemId);
    const selectedItems = statement.items.filter((si) =>
      statementItemIds.includes(si.id),
    );

    if (selectedItems.length === 0) {
      throw new BadRequestException({
        errorCode: 'STMT_ITEMS_NOT_FOUND',
        message: 'Selected items not found in this statement',
      });
    }

    const defaultCategory = await this.prisma.category.findFirst({
      where: { groupId: circleId, isDefault: true },
    });

    const createdExpenseIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const acceptItem of dto.items) {
        const stmtItem = selectedItems.find((si) => si.id === acceptItem.statementItemId);
        if (!stmtItem) continue;

        const categoryId = acceptItem.categoryId || defaultCategory?.id || '';

        const expense = await tx.transaction.create({
          data: {
            groupId: circleId,
            userId,
            type: 'expense',
            amount: stmtItem.amount,
            currency: stmtItem.currency as any,
            categoryId,
            description: stmtItem.description,
            merchantName: stmtItem.description,
            source: 'statement',
            confirmationStatus: 'confirmed',
            transactionDate: stmtItem.date,
            paymentMethod: 'card',
            cardId: statement.cardId,
          },
        });

        await tx.statementItem.update({
          where: { id: stmtItem.id },
          data: { matchedTransactionId: expense.id },
        });

        createdExpenseIds.push(expense.id);
      }

      await tx.cardStatement.update({
        where: { id: previewId },
        data: { isConfirmed: true },
      });
    });

    if (statement.filePath) {
      try {
        fs.unlinkSync(statement.filePath);
      } catch {
        this.logger.warn(`Failed to purge temp file: ${statement.filePath}`);
      }
    }

    try {
      await this.anomalyService.detectAnomaliesForCircle(circleId);
    } catch (err) {
      this.logger.warn(`Anomaly detection failed after statement accept: ${err.message}`);
    }

    return { createdExpenseIds, count: createdExpenseIds.length };
  }

  async reportFraud(
    previewId: string,
    userId: string,
    circleId: string,
    dto: ReportFraudDto,
  ) {
    const statement = await this.prisma.cardStatement.findUnique({
      where: { id: previewId },
      include: { card: true, items: true },
    });

    if (!statement) {
      throw new NotFoundException({
        errorCode: 'STMT_PREVIEW_NOT_FOUND',
        message: 'Statement not found',
      });
    }

    if (statement.card.groupId !== circleId) {
      throw new ForbiddenException({
        errorCode: 'STMT_PERMISSION_DENIED',
        message: 'Statement not found',
      });
    }

    if (!dto.statementItemIds || dto.statementItemIds.length === 0) {
      throw new BadRequestException({
        errorCode: 'STMT_NO_ITEMS_SELECTED',
        message: 'No items selected to report as fraud',
      });
    }

    const fraudItems = statement.items.filter((si) =>
      dto.statementItemIds.includes(si.id),
    );

    if (fraudItems.length === 0) {
      throw new BadRequestException({
        errorCode: 'STMT_ITEMS_NOT_FOUND',
        message: 'Selected items not found in this statement',
      });
    }

    const defaultCategory = await this.prisma.category.findFirst({
      where: { groupId: circleId, isDefault: true },
    });

    const reportedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of fraudItems) {
        const fraudExpense = await tx.transaction.create({
          data: {
            groupId: circleId,
            userId,
            type: 'expense',
            amount: item.amount,
            currency: item.currency as any,
            categoryId: defaultCategory?.id || '',
            description: `[FRAUD REPORT] ${item.description}`,
            merchantName: item.description,
            source: 'statement',
            confirmationStatus: 'pending_confirmation',
            transactionDate: item.date,
            paymentMethod: 'card',
            cardId: statement.cardId,
          },
        });

        await tx.statementItem.update({
          where: { id: item.id },
          data: { matchedTransactionId: fraudExpense.id },
        });

        await tx.anomalyAlert.create({
          data: {
            groupId: circleId,
            transactionId: fraudExpense.id,
            statementItemId: item.id,
            alertType: 'orphaned_duplicate',
            severity: 'critical',
          },
        });

        reportedIds.push(fraudExpense.id);
      }
    });

    this.logger.warn(
      `Fraud reported for ${fraudItems.length} items on statement ${previewId} (card ${statement.cardId})`,
    );

    return { reportedIds, count: reportedIds.length };
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
