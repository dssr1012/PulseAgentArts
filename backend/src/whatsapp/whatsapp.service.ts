import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { WhatsappMessageParser } from './whatsapp-message.parser';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';

interface WhatsappSession {
  userId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  qrCode: string | null;
  phone: string | null;
  sock: any;
  saveCreds: () => Promise<void>;
}

@Injectable()
export class WhatsappService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly sessions = new Map<string, WhatsappSession>();
  private readonly authDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private transactionService: TransactionService,
    private messageParser: WhatsappMessageParser,
  ) {
    this.authDir = this.config.get<string>('WHATSAPP_AUTH_DIR', './whatsapp-auth');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async connect(userId: string): Promise<{ qrCode: string | null; status: string }> {
    const existing = this.sessions.get(userId);
    if (existing && existing.status === 'connected') {
      return { qrCode: null, status: 'connected' };
    }
    if (existing && existing.status === 'connecting') {
      return { qrCode: existing.qrCode, status: 'connecting' };
    }

    await this.startSession(userId);
    const session = this.sessions.get(userId);
    return { qrCode: session?.qrCode || null, status: session?.status || 'connecting' };
  }

  async disconnect(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session?.sock) {
      try {
        await session.sock.logout();
      } catch {
        try { await session.sock.end(); } catch { /* ignore */ }
      }
    }
    this.sessions.delete(userId);

    const userAuthDir = path.join(this.authDir, userId);
    if (fs.existsSync(userAuthDir)) {
      fs.rmSync(userAuthDir, { recursive: true, force: true });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { whatsappPhone: null },
    }).catch(() => { /* ignore */ });
  }

  getStatus(userId: string): { status: string; qrCode: string | null; phone: string | null } {
    const session = this.sessions.get(userId);
    return {
      status: session?.status || 'disconnected',
      qrCode: session?.qrCode || null,
      phone: session?.phone || null,
    };
  }

  async setDefaultCategory(userId: string, categoryId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { whatsappDefaultCategoryId: categoryId },
    });
  }

  private async startSession(userId: string): Promise<void> {
    const userAuthDir = path.join(this.authDir, userId);
    if (!fs.existsSync(userAuthDir)) {
      fs.mkdirSync(userAuthDir, { recursive: true });
    }

    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
    const { state, saveCreds } = await useMultiFileAuthState(userAuthDir);

    const baileysLogger = {
      level: 'silent',
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      trace: () => {},
      child: () => baileysLogger,
    };

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger as any,
    });

    const session: WhatsappSession = {
      userId,
      status: 'connecting',
      qrCode: null,
      phone: null,
      sock,
      saveCreds,
    };
    this.sessions.set(userId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          session.qrCode = qrDataUrl;
          session.status = 'connecting';
          this.logger.log(`QR code generated for user ${userId}`);
        } catch (err) {
          this.logger.error(`Failed to generate QR: ${err.message}`);
        }
      }

      if (connection === 'open') {
        session.status = 'connected';
        session.qrCode = null;
        const phone = sock.user?.id?.split(':')[0]?.replace('@s.whatsapp.net', '') || null;
        session.phone = phone;
        this.logger.log(`WhatsApp connected for user ${userId}, phone: ${phone}`);

        await this.prisma.user.update({
          where: { id: userId },
          data: { whatsappPhone: phone },
        }).catch(() => { /* ignore */ });
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        session.status = 'disconnected';
        session.qrCode = null;
        this.logger.warn(`WhatsApp disconnected for user ${userId}, reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => this.startSession(userId), 3000);
        } else {
          this.sessions.delete(userId);
        }
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      try {
        await this.handleMessage(userId, m);
      } catch (err) {
        this.logger.error(`Message handling failed: ${err.message}`);
      }
    });
  }

  private async handleMessage(userId: string, m: any): Promise<void> {
    const messages = m.messages;
    if (!messages || messages.length === 0) return;
    if (m.type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe !== true) continue;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (!text.trim()) continue;

      const parsed = this.messageParser.parse(text);
      if (!parsed) {
        await this.sendReply(userId, msg.key.remoteJid, 'No pude entender el mensaje. Ejemplo: "gaste 1500 en super" o "1500 super"');
        continue;
      }

      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { circleMembership: true },
        });
        if (!user?.circleMembership) {
          await this.sendReply(userId, msg.key.remoteJid, 'No perteneces a un grupo. Crea o únete a un grupo primero.');
          continue;
        }

        const circleId = user.circleMembership.groupId;
        const categoryId = await this.resolveCategory(userId, circleId, text);

        const created = await this.transactionService.createExpense(userId, circleId, {
          amount: parsed.amount,
          currency: parsed.currency,
          categoryId,
          description: parsed.description,
          source: 'whatsapp' as any,
          confirmationStatus: 'pending_confirmation',
          transactionDate: new Date().toISOString(),
        });

        await this.sendReply(
          userId,
          msg.key.remoteJid,
          `Gasto cargado: $${parsed.amount} en "${parsed.description}" (pendiente de confirmación)`,
        );
        this.logger.log(`Expense created via WhatsApp for user ${userId}: ${created.id}`);
      } catch (err) {
        this.logger.error(`Failed to create expense from WhatsApp: ${err.message}`);
        await this.sendReply(userId, msg.key.remoteJid, `Error al cargar el gasto: ${err.message}`);
      }
    }
  }

  private async resolveCategory(userId: string, circleId: string, text: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.whatsappDefaultCategoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: user.whatsappDefaultCategoryId, groupId: circleId },
      });
      if (cat) return cat.id;
    }

    const suggested = this.messageParser.suggestCategory(text);
    if (suggested) {
      const cat = await this.prisma.category.findFirst({
        where: { groupId: circleId, name: { equals: suggested, mode: 'insensitive' } },
      });
      if (cat) return cat.id;
    }

    const defaultCat = await this.prisma.category.findFirst({
      where: { groupId: circleId, isDefault: true },
    });
    if (defaultCat) return defaultCat.id;

    const anyCat = await this.prisma.category.findFirst({
      where: { groupId: circleId },
    });
    if (anyCat) return anyCat.id;

    const created = await this.prisma.category.create({
      data: { groupId: circleId, name: 'General', icon: '📦' },
    });
    return created.id;
  }

  private async sendReply(userId: string, jid: string, text: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session?.sock || session.status !== 'connected') return;
    try {
      await session.sock.sendMessage(jid, { text });
    } catch (err) {
      this.logger.error(`Failed to send WhatsApp reply: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [userId, session] of this.sessions) {
      try {
        if (session.sock) await session.sock.end();
      } catch { /* ignore */ }
      this.logger.log(`WhatsApp session closed for user ${userId}`);
    }
    this.sessions.clear();
  }
}
