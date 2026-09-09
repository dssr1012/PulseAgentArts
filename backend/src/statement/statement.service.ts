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
  ) {}

  async uploadAndParse(
    cardId: string,
    circleId: string,
    file: Express.Multer.File,
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
      const parsed = await this.pdfParser.parse(file.buffer);

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
      this.logger.error(`Statement parsing failed: ${error.message}`);
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

    return { createdExpenseIds };
  }
}