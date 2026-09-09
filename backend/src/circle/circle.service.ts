import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class CircleService {
  private readonly logger = new Logger(CircleService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createCircle(userId: string, name: string, baseCurrency: string = 'ARS') {
    // Check single-circle constraint
    const existingMembership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException({
        errorCode: 'CIRCLE_ALREADY_MEMBER',
        message: 'You already belong to a Family Circle',
      });
    }

    // Create circle with admin and default categories in a transaction
    const circle = await this.prisma.$transaction(async (tx) => {
      const group = await tx.familyGroup.create({
        data: {
          name,
          adminUserId: userId,
          baseCurrency,
        },
      });

      // Add creator as admin member
      await tx.familyGroupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'admin',
        },
      });

      // Provision default categories
      const defaultCategories = [
        { name: 'Alimentación', icon: '🍽️' },
        { name: 'Servicios', icon: '💡' },
        { name: 'Transporte', icon: '🚗' },
        { name: 'Salud', icon: '🏥' },
      ];

      await tx.category.createMany({
        data: defaultCategories.map((cat) => ({
          groupId: group.id,
          name: cat.name,
          icon: cat.icon,
          isDefault: true,
        })),
      });

      return group;
    });

    this.logger.log(`Circle created: ${circle.id} by user ${userId}`);
    return circle;
  }

  async getCircle(circleId: string, userId: string) {
    const membership = await this.prisma.familyGroupMember.findFirst({
      where: { groupId: circleId, userId },
    });

    if (!membership) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'You are not a member of this circle',
      });
    }

    const circle = await this.prisma.familyGroup.findUnique({
      where: { id: circleId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                givenName: true,
                email: true,
                pictureUrl: true,
              },
            },
          },
        },
      },
    });

    if (!circle) {
      throw new NotFoundException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'Circle not found',
      });
    }

    return {
      id: circle.id,
      name: circle.name,
      baseCurrency: circle.baseCurrency,
      adminUserId: circle.adminUserId,
      createdAt: circle.createdAt,
      members: circle.members.map((m) => ({
        userId: m.user.id,
        givenName: m.user.givenName,
        email: m.user.email,
        pictureUrl: m.user.pictureUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async createInvitation(circleId: string, email: string, userId: string) {
    // Verify user is admin
    const membership = await this.prisma.familyGroupMember.findFirst({
      where: { groupId: circleId, userId },
    });

    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'Only circle administrators can send invitations',
      });
    }

    // Check if invitee is already a member
    const inviteeUser = await this.prisma.user.findUnique({ where: { email } });
    if (inviteeUser) {
      const inviteeMembership = await this.prisma.familyGroupMember.findUnique({
        where: { userId: inviteeUser.id },
      });
      if (inviteeMembership) {
        throw new ConflictException({
          errorCode: 'INVITE_ALREADY_MEMBER',
          message: 'This user is already a member of a circle',
        });
      }
    }

    // Generate token with 128-bit entropy
    const rawToken = crypto.randomBytes(
      this.config.get<number>('INVITATION_TOKEN_BYTES', 16),
    ).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const ttlHours = this.config.get<number>('INVITATION_TTL_HOURS', 72);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        groupId: circleId,
        tokenHash,
        email,
        expiresAt,
        status: 'pending',
      },
    });

    // Send invitation email
    try {
      await this.sendInvitationEmail(email, rawToken, circleId);
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'sent' },
      });
    } catch (error) {
      this.logger.error(`Failed to send invitation email: ${error.message}`);
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'delivery_failed' },
      });
    }

    return {
      id: invitation.id,
      email,
      status: invitation.status === 'pending' ? 'delivery_failed' : 'sent',
      expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async validateInvitation(token: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { group: true },
    });

    if (!invitation) {
      throw new GoneException({
        errorCode: 'INVITE_EXPIRED',
        message: 'This invitation does not exist or has expired',
      });
    }

    if (invitation.status === 'accepted') {
      throw new GoneException({
        errorCode: 'INVITE_CONSUMED',
        message: 'This invitation has already been used',
      });
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new GoneException({
        errorCode: 'INVITE_EXPIRED',
        message: 'This invitation has expired. Please request a new one.',
      });
    }

    return {
      valid: true,
      circleName: invitation.group.name,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.expiresAt < new Date() || invitation.status === 'accepted') {
      throw new GoneException({
        errorCode: 'INVITE_EXPIRED',
        message: 'This invitation is invalid or has expired',
      });
    }

    // Check single-circle constraint
    const existingMembership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException({
        errorCode: 'CIRCLE_ALREADY_MEMBER',
        message: 'You already belong to a Family Circle',
      });
    }

    // Accept invitation in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.create({
        data: {
          groupId: invitation.groupId,
          userId,
          role: 'member',
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    });

    this.logger.log(`User ${userId} accepted invitation to circle ${invitation.groupId}`);

    return {
      groupId: invitation.groupId,
      role: 'member',
    };
  }

  async removeMember(circleId: string, memberUserId: string, requestingUserId: string) {
    // Verify requesting user is admin
    const requesterMembership = await this.prisma.familyGroupMember.findFirst({
      where: { groupId: circleId, userId: requestingUserId },
    });

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'Only circle administrators can remove members',
      });
    }

    // Cannot remove admin
    const targetMembership = await this.prisma.familyGroupMember.findFirst({
      where: { groupId: circleId, userId: memberUserId },
    });

    if (!targetMembership) {
      throw new NotFoundException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'Member not found in this circle',
      });
    }

    if (targetMembership.role === 'admin') {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'Cannot remove the circle administrator',
      });
    }

    await this.prisma.familyGroupMember.delete({
      where: {
        groupId_userId: {
          groupId: circleId,
          userId: memberUserId,
        },
      },
    });

    this.logger.log(`Member ${memberUserId} removed from circle ${circleId}`);
  }

  async getInvitations(circleId: string, userId: string) {
    const membership = await this.prisma.familyGroupMember.findFirst({
      where: { groupId: circleId, userId },
    });

    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'Only circle administrators can view invitations',
      });
    }

    return this.prisma.invitation.findMany({
      where: { groupId: circleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async sendInvitationEmail(email: string, token: string, circleId: string): Promise<void> {
    const baseUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const invitationLink = `${baseUrl}/invitations/${token}`;

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: this.config.get<string>('EMAIL_FROM', 'noreply@pulseexpends.com'),
      to: email,
      subject: 'Invitación a Círculo Familiar - PulseExpends',
      html: `
        <h1>¡Has sido invitado a un Círculo Familiar!</h1>
        <p>Haz clic en el siguiente enlace para unirte:</p>
        <a href="${invitationLink}" style="padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px;">
          Aceptar Invitación
        </a>
        <p>Este enlace expirará en 72 horas.</p>
      `,
    });
  }
}