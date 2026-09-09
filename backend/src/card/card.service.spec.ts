import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CardService } from './card.service';
import { PrismaService } from '../common/prisma.service';

describe('CardService', () => {
  let service: CardService;
  let prisma: jest.Mocked<PrismaService>;

  const mockCard = {
    id: 'card-1',
    groupId: 'circle-1',
    bankName: 'Santander',
    cardType: 'Visa',
    lastFourDigits: '1234',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        {
          provide: PrismaService,
          useValue: {
            creditCard: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<CardService>(CardService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Create Card ─────────────────────────────────────────────────

  describe('createCard', () => {
    it('should create a card with only bank_name, card_type, and last_4_digits', async () => {
      (prisma.creditCard.create as jest.Mock).mockResolvedValue(mockCard);

      const result = await service.createCard('user-1', 'circle-1', {
        bankName: 'Santander',
        cardType: 'Visa',
        last4Digits: '1234',
      });

      expect(result.id).toBe('card-1');
      expect(prisma.creditCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bankName: 'Santander',
            cardType: 'Visa',
            lastFourDigits: '1234',
          }),
        }),
      );
    });

    it('should NOT store PAN or CVV - only last 4 digits', async () => {
      (prisma.creditCard.create as jest.Mock).mockResolvedValue(mockCard);

      const createCall = prisma.creditCard.create as jest.Mock;

      await service.createCard('user-1', 'circle-1', {
        bankName: 'Santander',
        cardType: 'Visa',
        last4Digits: '5678',
      });

      const dataArg = createCall.mock.calls[0][0].data;
      // Verify no PAN or CVV fields in the data
      expect(dataArg.pan).toBeUndefined();
      expect(dataArg.cvv).toBeUndefined();
      expect(dataArg.cardNumber).toBeUndefined();
      expect(dataArg.securityCode).toBeUndefined();
      // Only lastFourDigits should be present
      expect(dataArg.lastFourDigits).toBe('5678');
    });

    it('should associate card with the circle', async () => {
      (prisma.creditCard.create as jest.Mock).mockResolvedValue(mockCard);

      await service.createCard('user-1', 'circle-1', {
        bankName: 'Galicia',
        cardType: 'Mastercard',
        last4Digits: '9999',
      });

      expect(prisma.creditCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ groupId: 'circle-1' }),
        }),
      );
    });

    it('should support Visa card type', async () => {
      (prisma.creditCard.create as jest.Mock).mockResolvedValue({
        ...mockCard,
        cardType: 'Visa',
      });

      const result = await service.createCard('user-1', 'circle-1', {
        bankName: 'Santander',
        cardType: 'Visa',
        last4Digits: '1234',
      });

      expect(result.cardType).toBe('Visa');
    });

    it('should support Mastercard card type', async () => {
      (prisma.creditCard.create as jest.Mock).mockResolvedValue({
        ...mockCard,
        cardType: 'Mastercard',
      });

      const result = await service.createCard('user-1', 'circle-1', {
        bankName: 'Galicia',
        cardType: 'Mastercard',
        last4Digits: '5678',
      });

      expect(result.cardType).toBe('Mastercard');
    });
  });

  // ─── List Cards ──────────────────────────────────────────────────

  describe('listCards', () => {
    it('should return cards for the circle', async () => {
      (prisma.creditCard.findMany as jest.Mock).mockResolvedValue([mockCard]);

      const result = await service.listCards('circle-1');

      expect(result).toHaveLength(1);
      expect(result[0].lastFourDigits).toBe('1234');
    });

    it('should order cards by creation date descending', async () => {
      (prisma.creditCard.findMany as jest.Mock).mockResolvedValue([]);

      await service.listCards('circle-1');

      expect(prisma.creditCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ─── Delete Card ─────────────────────────────────────────────────

  describe('deleteCard', () => {
    it('should delete a card from the circle', async () => {
      (prisma.creditCard.findUnique as jest.Mock).mockResolvedValue(mockCard);
      (prisma.creditCard.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteCard('card-1', 'circle-1');

      expect(prisma.creditCard.delete).toHaveBeenCalledWith({
        where: { id: 'card-1' },
      });
    });

    it('should throw NotFoundException for non-existent card', async () => {
      (prisma.creditCard.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteCard('card-99', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for card from different circle', async () => {
      (prisma.creditCard.findUnique as jest.Mock).mockResolvedValue({
        ...mockCard,
        groupId: 'circle-2',
      });

      await expect(
        service.deleteCard('card-1', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});