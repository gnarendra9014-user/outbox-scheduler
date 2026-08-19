import nodemailer from 'nodemailer';
import prisma from '../db/prisma';

// Cache transporters per sender to avoid creating new ones for each email
const transporterCache = new Map<string, nodemailer.Transporter>();

interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

/**
 * Get or create a Nodemailer transporter for a specific sender.
 * Uses Ethereal SMTP credentials stored in the Sender table.
 */
async function getTransporter(senderEmail: string): Promise<nodemailer.Transporter> {
  const cached = transporterCache.get(senderEmail);
  if (cached) return cached;

  // Look up sender credentials from DB
  const sender = await prisma.sender.findUnique({
    where: { email: senderEmail },
  });

  if (!sender) {
    throw new Error(`Sender ${senderEmail} not found in database`);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: sender.etherealUser,
      pass: sender.etherealPass,
    },
  });

  // Verify the transporter connection
  await transporter.verify();

  transporterCache.set(senderEmail, transporter);
  return transporter;
}

/**
 * Send an email via Ethereal SMTP.
 * Returns the Ethereal message ID and preview URL.
 */
export async function sendEmailViaSMTP(
  senderEmail: string,
  recipientEmail: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const transporter = await getTransporter(senderEmail);

  const sender = await prisma.sender.findUnique({
    where: { email: senderEmail },
  });

  const info = await transporter.sendMail({
    from: `"${sender?.name || 'Outbox'}" <${senderEmail}>`,
    to: recipientEmail,
    subject,
    text: body.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
    html: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
  };
}

/**
 * Create Ethereal test accounts and seed them as senders.
 * Call this on first startup if no senders exist.
 */
export async function seedEtherealSenders(count: number = 3): Promise<void> {
  const existingSenders = await prisma.sender.count();
  if (existingSenders > 0) {
    console.log(`[EmailService] ${existingSenders} sender(s) already exist — skipping seed`);
    return;
  }

  console.log(`[EmailService] Creating ${count} Ethereal test sender accounts...`);

  for (let i = 0; i < count; i++) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      await prisma.sender.create({
        data: {
          email: testAccount.user,
          name: `Sender ${i + 1}`,
          etherealUser: testAccount.user,
          etherealPass: testAccount.pass,
        },
      });
      console.log(`[EmailService] ✅ Created sender: ${testAccount.user}`);
    } catch (err: any) {
      console.error(`[EmailService] ❌ Failed to create Ethereal account ${i + 1}:`, err.message);
    }
  }
}

/**
 * Clear the transporter cache (used on shutdown).
 */
export function clearTransporterCache(): void {
  transporterCache.forEach((transporter) => {
    transporter.close();
  });
  transporterCache.clear();
}
