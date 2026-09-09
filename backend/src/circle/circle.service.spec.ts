import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { CircleService } from './circle.service';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('b'.repeat(32), 'hex')),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-1' }),
  }),
}));

describe('CircleService', () => {
  let service: CircleService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  const mockCircle = {
    id: 'circle-1',
    name: 'Familia Pérez',
    adminUserId: 'user-1',
    baseCurrency: 'ARS',
    createdAt: new Date(),
  };

  const mockMembership = {
    userId: 'user-1',
    groupId: 'circle-1',
    role: 'admin',
    joinedAt: new Date(),
    user: {
      id: 'user-1',
      givenName: 'Admin',
      email: 'admin@example.com',
      pictureUrl: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircleService,
        {
          provide: PrismaService,
          useValue: {
            familyGroupMember: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            familyGroup: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            invitation: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            category: {
              createMany: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                INVITATION_TOKEN_BYTES: 16,
                INVITATION_TTL_HOURS: 72,
                FRONTEND_URL: 'http://localhost:3001',
                SMTP_HOST: 'smtp.example.com',
                SMTP_PORT: 587,
                SMTP_SECURE: false,
                SMTP_USER: 'test@test.com',
                SMTP_PASS: 'pass',
                EMAIL_FROM: 'noreply@pulseexpends.com',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CircleService>(CircleService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Circle Creation ─────────────────────────────────────────────

  describe('createCircle', () => {
    it('should create a circle and assign creator as admin', async () => {
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.familyGroup.create as jest.Mock).mockResolvedValue(mockCircle);
      (prisma.familyGroupMember.create as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.category.createMany as jest.Mock).mockResolvedValue({ count: 4 });

      const result = await service.createCircle('user-1', 'Familia Pérez', 'ARS');

      expect(result).toBeDefined();
      expect(prisma.familyGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Familia Pérez',
            adminUserId: 'user-1',
            baseCurrency: 'ARS',
          }),
        }),
      );
      expect(prisma.familyGroupMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            role: 'admin',
          }),
        }),
      );
    });

    it('should provision default categories on circle creation', async () => {
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.familyGroup.create as jest.Mock).mockResolvedValue(mockCircle);
      (prisma.familyGroupMember.create as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.category.createMany as jest.Mock).mockResolvedValue({ count: 4 });

      await service.createCircle('user-1', 'Familia Pérez');

      expect(prisma.category.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Alimentación', isDefault: true }),
            expect.objectContaining({ name: 'Servicios', isDefault: true }),
            expect.objectContaining({ name: 'Transporte', isDefault: true }),
            expect.objectContaining({ name: 'Salud', isDefault: true }),
          ]),
        }),
      );
    });

    it('should throw ConflictException if user already belongs to a circle', async () => {
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await expect(
        service.createCircle('user-1', 'Another Circle'),
      ).rejects.toThrow(ConflictException);
    });

    it('should use ARS as default base currency', async () => {
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.familyGroup.create as jest.Mock).mockResolvedValue(mockCircle);
      (prisma.familyGroupMember.create as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.category.createMany as jest.Mock).mockResolvedValue({ count: 4 });

      await service.createCircle('user-1', 'Test Circle');

      expect(prisma.familyGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ baseCurrency: 'ARS' }),
        }),
      );
    });
  });

  // ─── Get Circle ──────────────────────────────────────────────────

  describe('getCircle', () => {
    it('should return circle details for member', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
        ...mockCircle,
        members: [mockMembership],
      });

      const result = await service.getCircle('circle-1', 'user-1');

      expect(result.id).toBe('circle-1');
      expect(result.members).toBeDefined();
    });

    it('should throw ForbiddenException for non-member', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getCircle('circle-1', 'non-member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if circle not found', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getCircle('circle-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Invitation Creation ─────────────────────────────────────────

  describe('createInvitation', () => {
    it('should generate invitation token and send email', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.create as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        email: 'invitee@example.com',
        status: 'pending',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdAt: new Date(),
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        status: 'sent',
      });

      const result = await service.createInvitation(
        'circle-1',
        'invitee@example.com',
        'user-1',
      );

      expect(result).toBeDefined();
      expect(prisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'invitee@example.com',
            status: 'pending',
          }),
        }),
      );
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue({
        ...mockMembership,
        role: 'member',
      });

      await expect(
        service.createInvitation('circle-1', 'invitee@example.com', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if invitee is already a member', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-2' });
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-2',
        groupId: 'circle-1',
        role: 'member',
      });

      await expect(
        service.createInvitation('circle-1', 'existing@example.com', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should set invitation expiry to 72 hours', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.create as jest.Mock).mockImplementation(({ data }) => ({
        id: 'inv-1',
        ...data,
        createdAt: new Date(),
      }));
      (prisma.invitation.update as jest.Mock).mockResolvedValue({ status: 'sent' });

      await service.createInvitation('circle-1', 'invitee@example.com', 'user-1');

      const createCall = (prisma.invitation.create as jest.Mock).mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const now = Date.now();
      const diffHours = (expiresAt.getTime() - now) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThanOrEqual(71.9);
      expect(diffHours).toBeLessThanOrEqual(72.1);
    });
  });

  // ─── Invitation Validation ───────────────────────────────────────

  describe('validateInvitation', () => {
    it('should return valid invitation info for non-expired token', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        email: 'invitee@example.com',
        status: 'sent',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h in future
        group: { name: 'Familia Pérez' },
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);

      const result = await service.validateInvitation('some-token');

      expect(result.valid).toBe(true);
      expect(result.circleName).toBe('Familia Pérez');
    });

    it('should throw GoneException for expired invitation', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        email: 'invitee@example.com',
        status: 'sent',
        expiresAt: new Date(Date.now() - 1000), // expired
        group: { name: 'Familia Pérez' },
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);
      (prisma.invitation.update as jest.Mock).mockResolvedValue({ status: 'expired' });

      await expect(
        service.validateInvitation('expired-token'),
      ).rejects.toThrow(GoneException);
    });

    it('should throw GoneException for already consumed invitation', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        email: 'invitee@example.com',
        status: 'accepted',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        group: { name: 'Familia Pérez' },
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);

      await expect(
        service.validateInvitation('consumed-token'),
      ).rejects.toThrow(GoneException);
    });

    it('should throw GoneException for non-existent token', async () => {
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateInvitation('nonexistent-token'),
      ).rejects.toThrow(GoneException);
    });
  });

  // ─── Invitation Acceptance ───────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should add user as member and consume invitation', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        groupId: 'circle-1',
        email: 'invitee@example.com',
        status: 'sent',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.familyGroupMember.create as jest.Mock).mockResolvedValue({
        userId: 'user-2',
        groupId: 'circle-1',
        role: 'member',
      });
      (prisma.invitation.update as jest.Mock).mockResolvedValue({
        ...invitation,
        status: 'accepted',
      });

      const result = await service.acceptInvitation('valid-token', 'user-2');

      expect(result.groupId).toBe('circle-1');
      expect(result.role).toBe('member');
    });

    it('should throw ConflictException if user already in another circle', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        groupId: 'circle-2',
        status: 'sent',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-2',
        groupId: 'circle-1',
        role: 'member',
      });

      await expect(
        service.acceptInvitation('valid-token', 'user-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw GoneException for expired invitation', async () => {
      const invitation = {
        id: 'inv-1',
        tokenHash: 'hash',
        groupId: 'circle-1',
        status: 'sent',
        expiresAt: new Date(Date.now() - 1000), // expired
      };
      (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(invitation);

      await expect(
        service.acceptInvitation('expired-token', 'user-2'),
      ).rejects.toThrow(GoneException);
    });
  });

  // ─── Member Management ───────────────────────────────────────────

  describe('removeMember', () => {
    it('should allow admin to remove a member', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockMembership) // requester check
        .mockResolvedValueOnce({ // target check
          userId: 'user-2',
          groupId: 'circle-1',
          role: 'member',
        });
      (prisma.familyGroupMember.delete as jest.Mock).mockResolvedValue(undefined);

      await service.removeMember('circle-1', 'user-2', 'user-1');

      expect(prisma.familyGroupMember.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-admin requester', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue({
        ...mockMembership,
        role: 'member',
      });

      await expect(
        service.removeMember('circle-1', 'user-2', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to remove admin', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce({
          userId: 'user-1',
          groupId: 'circle-1',
          role: 'admin',
        });

      await expect(
        service.removeMember('circle-1', 'user-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent member', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockMembership)
        .mockResolvedValueOnce(null);

      await expect(
        service.removeMember('circle-1', 'user-99', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Get Invitations ─────────────────────────────────────────────

  describe('getInvitations', () => {
    it('should return invitations for admin', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue(mockMembership);
      (prisma.invitation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getInvitations('circle-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      (prisma.familyGroupMember.findFirst as jest.Mock).mockResolvedValue({
        ...mockMembership,
        role: 'member',
      });

      await expect(
        service.getInvitations('circle-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});