import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { TransactionService } from '../transaction/transaction.service';
import { WhatsappMessageParser, ParsedExpenseMessage } from './whatsapp-message.parser';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { CopilotService } from '../projection/copilot.service';
import { SttService } from '../stt/stt.service';
import { VisionService } from '../stt/vision.service';
import { CardPaymentService } from '../card-payment/card-payment.service';
import { ParsedExpenseFromLlm } from '../llm/llm.interface';
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
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly sessions = new Map<string, WhatsappSession>();
  private readonly authDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private transactionService: TransactionService,
    private messageParser: WhatsappMessageParser,
    private llmOrchestrator: LlmOrchestratorService,
    private copilotService: CopilotService,
    private sttService: SttService,
    private visionService: VisionService,
    private cardPaymentService: CardPaymentService,
  ) {
    this.authDir = this.config.get<string>('WHATSAPP_AUTH_DIR', './whatsapp-auth');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      const entries = fs.readdirSync(this.authDir, { withFileTypes: true });
      const userDirs = entries.filter(e => e.isDirectory() && fs.existsSync(path.join(this.authDir, e.name, 'creds.json')));
      if (userDirs.length === 0) return;
      this.logger.log(`Restoring ${userDirs.length} WhatsApp session(s)...`);
      for (const dir of userDirs) {
        this.startSession(dir.name).catch(err => {
          this.logger.error(`Failed to restore session for ${dir.name}: ${err.message}`);
        });
      }
    } catch (err) {
      this.logger.error(`Failed to scan WhatsApp auth directory: ${err.message}`);
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

    const expenseGroups = await this.prisma.whatsappGroup.findMany({
      where: { userId },
      select: { groupJid: true, groupName: true },
    });
    if (expenseGroups.length === 0) return;

    const allowedJids = new Set(expenseGroups.map((g) => g.groupJid));

    for (const msg of messages) {
      if (!msg.message) continue;

      const remoteJid = msg.key?.remoteJid || '';
      if (!allowedJids.has(remoteJid)) continue;

      let text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      let visionParsed: ParsedExpenseFromLlm | null = null;

      // Fetch user and circle info early (needed for text, audio, and image paths)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { circleMemberships: true },
      });
      if (!user?.circleMemberships || user.circleMemberships.length === 0) continue;
      const circleId = user.circleMemberships[0].groupId;

      // Handle voice notes (audio/PTT messages) via Groq Whisper STT
      const audioMsg = msg.message.audioMessage || msg.message.pttMessage;
      if (!text.trim() && audioMsg) {
        try {
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: this.logger } as any);
          const mimeType = audioMsg.mimetype || 'audio/ogg; codecs=opus';
          this.logger.log('Received voice note, transcribing...');
          const result = await this.sttService.transcribe(mediaBuffer as Buffer, mimeType);
          if (result?.text) {
            text = result.text;
            this.logger.log('Voice note transcribed: "' + text.substring(0, 60) + '..."');
          } else {
            this.logger.warn('Voice note transcription returned no text');
          }
        } catch (err) {
          this.logger.error('Voice note handling failed: ' + (err).message);
        }
      }

      // Handle image messages (receipts/invoices) via Groq Vision
      const imageMsg = msg.message.imageMessage;
      if (!text.trim() && imageMsg) {
        try {
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: this.logger } as any);
          const mimeType = imageMsg.mimetype || 'image/jpeg';
          this.logger.log('Received image, extracting expense via vision...');

          const categories = await this.prisma.category.findMany({
            where: { groupId: circleId },
            select: { name: true },
          });
          const cards = await this.prisma.creditCard.findMany({
            where: { groupId: circleId },
            select: { tag: true, lastFourDigits: true, bankName: true },
          });

          visionParsed = await this.visionService.extractExpense(
            mediaBuffer as Buffer,
            mimeType,
            categories.map((c) => c.name),
            cards.map((c) => ({ ...c, tag: c.tag || undefined })),
            imageMsg.caption || '',
          );

          if (visionParsed) {
            this.logger.log(`Vision extracted expense: ${visionParsed.amount} ${visionParsed.currency} (confidence: ${visionParsed.confidence})`);
          }
        } catch (err) {
          this.logger.error('Image/receipt handling failed: ' + (err).message);
        }
      }

      if (!text.trim() && !visionParsed) continue;

      // Check if this is a card payment message (e.g. "pague tarjeta visa 50000")
      const cardPaymentResult = await this.tryHandleCardPayment(userId, circleId, text);
      if (cardPaymentResult) {
        await this.sendReply(userId, msg.key.remoteJid, cardPaymentResult);
        this.logger.log(`Card payment handled via WhatsApp: ${text.substring(0, 60)}`);
        continue;
      }

      // If vision already parsed the expense, use it directly; otherwise parse text
      let parsed: ParsedExpenseMessage | null = null;

      if (visionParsed && visionParsed.amount > 0 && visionParsed.confidence >= 0.5) {
        parsed = {
          amount: visionParsed.amount,
          description: visionParsed.description || 'Gasto desde foto',
          currency: visionParsed.currency,
          paymentMethod: visionParsed.paymentMethod || 'cash',
          cardIdentifier: visionParsed.cardIdentifier,
          categoryName: visionParsed.category,
          merchantName: visionParsed.merchantName,
          transactionDate: visionParsed.transactionDate,
        };
        this.logger.log(`Expense from photo: ${parsed.amount} ${parsed.currency} at ${parsed.merchantName || 'unknown merchant'}`);
      } else {
        // Hybrid parsing: regex first, LLM fallback
        parsed = this.messageParser.parse(text);

      if (!parsed) {
        // Regex parser failed — try LLM
        try {
          const categories = await this.prisma.category.findMany({
            where: { groupId: circleId },
            select: { name: true },
          });
          const cards = await this.prisma.creditCard.findMany({
            where: { groupId: circleId },
            select: { tag: true, lastFourDigits: true, bankName: true },
          });

          const llmParsed = await this.llmOrchestrator.parseExpenseMessage(
            text,
            categories.map((c) => c.name),
            cards.map((c) => ({ ...c, tag: c.tag || undefined })),
          );

          if (llmParsed && llmParsed.amount > 0 && llmParsed.confidence >= 0.5) {
            parsed = {
              amount: llmParsed.amount,
              description: llmParsed.description || 'Gasto WhatsApp',
              currency: llmParsed.currency,
              paymentMethod: llmParsed.paymentMethod || 'cash',
              cardIdentifier: llmParsed.cardIdentifier,
              categoryName: llmParsed.category,
              merchantName: llmParsed.merchantName,
              transactionDate: llmParsed.transactionDate,
            };
            this.logger.log(`LLM parsed expense from WhatsApp: ${parsed.amount} ${parsed.currency} (confidence: ${llmParsed.confidence})`);
          }
        } catch (llmErr) {
          this.logger.warn(`LLM fallback parsing failed: ${llmErr.message}`);
        }
      // Check if this is an analysis request (not an expense)
      if (!parsed && this.copilotService.isAnalysisRequest(text)) {
        try {
          const analysisResponse = await this.copilotService.askWhatsApp(circleId, text);
          await this.sendReply(userId, msg.key.remoteJid, analysisResponse);
          this.logger.log(`WhatsApp analysis response sent for: ${text.substring(0, 50)}`);
        } catch (err) {
          this.logger.error(`WhatsApp analysis failed: ${err.message}`);
        }
        continue;
      }
      }
      }

      if (!parsed) continue;

      try {
        const categoryId = await this.resolveCategory(userId, circleId, text, parsed.categoryName);

        const senderName = msg.key?.fromMe
          ? ''
          : (msg.pushName ? `${msg.pushName}: ` : '');

        let paymentMethod: 'cash' | 'card' = parsed.paymentMethod;
        let cardId: string | undefined;

        if (parsed.paymentMethod === 'card') {
          if (parsed.cardIdentifier) {
            const isFourDigits = /^\d{4}$/.test(parsed.cardIdentifier);
            const card = await this.prisma.creditCard.findFirst({
              where: isFourDigits
                ? { groupId: circleId, lastFourDigits: parsed.cardIdentifier }
                : { groupId: circleId, tag: { equals: parsed.cardIdentifier, mode: 'insensitive' as any } },
            });
            if (card) {
              cardId = card.id;
            } else {
              paymentMethod = 'cash';
            }
          } else {
            const userCards = await this.prisma.creditCard.findMany({
              where: { groupId: circleId },
              select: { id: true },
            });
            if (userCards.length === 1) {
              cardId = userCards[0].id;
            } else {
              paymentMethod = 'cash';
            }
          }
        }

        const created = await this.transactionService.createExpense(userId, circleId, {
          amount: parsed.amount,
          currency: parsed.currency,
          categoryId,
          description: senderName + parsed.description,
          merchantName: parsed.merchantName,
          source: 'whatsapp' as any,
          confirmationStatus: 'pending_confirmation',
          transactionDate: parsed.transactionDate || new Date().toISOString(),
          paymentMethod,
          cardId,
        });

        const paymentLabel = paymentMethod === 'card' && cardId ? ' (tarjeta)' : ' (efectivo)';
        await this.sendReply(
          userId,
          msg.key.remoteJid,
          `Gasto cargado: $${parsed.amount} en "${parsed.description}"${paymentLabel} (pendiente de confirmación)`,
        );
        this.logger.log(`Expense created via WhatsApp for user ${userId}: ${created.id}`);
      } catch (err) {
        this.logger.error(`Failed to create expense from WhatsApp: ${err.message}`);
      }
    }
  }

  async listWhatsappGroups(userId: string): Promise<{ id: string; name: string; isExpenseGroup: boolean }[]> {
    const session = this.sessions.get(userId);
    if (!session?.sock || session.status !== 'connected') {
      return [];
    }

    let groups: any[] = [];
    try {
      groups = await session.sock.groupFetchAllParticipating();
    } catch (err) {
      this.logger.error(`Failed to fetch WhatsApp groups: ${err.message}`);
      return [];
    }

    const expenseGroups = await this.prisma.whatsappGroup.findMany({
      where: { userId },
      select: { groupJid: true },
    });
    const expenseJids = new Set(expenseGroups.map((g) => g.groupJid));

    return Object.entries(groups).map(([jid, meta]: [string, any]) => ({
      id: jid,
      name: meta.subject || meta.name || jid,
      isExpenseGroup: expenseJids.has(jid),
    }));
  }

  async getExpenseGroups(userId: string): Promise<{ id: string; groupJid: string; groupName: string | null }[]> {
    return this.prisma.whatsappGroup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addExpenseGroup(userId: string, groupJid: string, groupName?: string): Promise<void> {
    await this.prisma.whatsappGroup.upsert({
      where: { userId_groupJid: { userId, groupJid } },
      update: { groupName },
      create: { userId, groupJid, groupName },
    });
  }

  async removeExpenseGroup(userId: string, groupJid: string): Promise<void> {
    await this.prisma.whatsappGroup.deleteMany({
      where: { userId, groupJid },
    });
  }

  private async tryHandleCardPayment(
    userId: string,
    circleId: string,
    text: string,
  ): Promise<string | null> {
    // Match patterns like: "pago tarjeta 50000", "pague tarjeta visa 50000", "pagué la tarjeta 50000"
    const lower = text.toLowerCase().trim();
    if (!lower.startsWith("pago") && !lower.startsWith("pague") && !lower.startsWith("pagu\u00e9")) return null;

    // Extract amount — look for a number (Argentine format: dots as thousands separator)
    const amountMatch = text.match(/(\d[\d.]*\d|\d)/g);
    if (!amountMatch) return null;

    // Take the last number found (most likely the amount, not the card digits)
    const rawAmount = amountMatch[amountMatch.length - 1];
    const amount = parseFloat(rawAmount.replace(/\./g, ""));
    if (!amount || amount < 1) return null;

    // Try to find the card by tag or bank name in the message
    const cards = await this.prisma.creditCard.findMany({
      where: { groupId: circleId, cardMode: "credit" },
    });
    if (cards.length === 0) return null;

    let matchedCard = null;
    for (const card of cards) {
      const tag = card.tag?.toLowerCase() || "";
      const bank = card.bankName.toLowerCase();
      const last4 = card.lastFourDigits;
      if (
        (tag && lower.includes(tag)) ||
        (bank && lower.includes(bank)) ||
        lower.includes(last4)
      ) {
        matchedCard = card;
        break;
      }
    }

    // If only one credit card, use it
    if (!matchedCard && cards.length === 1) {
      matchedCard = cards[0];
    }

    if (!matchedCard) {
      return `No pude identificar la tarjeta. Tarjetas disponibles: ${cards.map((c) => c.tag || c.bankName).join(", ")}`;
    }

    try {
      await this.cardPaymentService.createPayment(
        userId,
        circleId,
        matchedCard.id,
        {
          amount,
          currency: "ARS",
          paymentDate: new Date().toISOString(),
          description: `Pago de tarjeta via WhatsApp`,
        },
        "whatsapp",
      );

      return `Pago de tarjeta registrado: ${amount} en ${matchedCard.bankName} ${matchedCard.lastFourDigits}${matchedCard.tag ? " (" + matchedCard.tag + ")" : ""}`;
    } catch (err) {
      this.logger.error(`Failed to create card payment from WhatsApp: ${err.message}`);
      return `Error al registrar el pago: ${err.message}`;
    }
  }

  private async resolveCategory(userId: string, circleId: string, text: string, explicitCategory?: string): Promise<string> {
    if (explicitCategory) {
      const cat = await this.prisma.category.findFirst({
        where: { groupId: circleId, name: { equals: explicitCategory, mode: 'insensitive' as any } },
      });
      if (cat) return cat.id;
    }

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
