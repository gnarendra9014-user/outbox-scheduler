import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { scheduleEmailBatch } from '../services/schedulerService';
import { parseEmailsFromContent } from '../utils/csvParser';
import prisma from '../db/prisma';
import { ScheduleEmailRequest, PaginatedResponse, EmailResponse, StatsResponse } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All email routes require authentication
router.use(authMiddleware);

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails.
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { subject, body, recipients, senderEmail, startTime, delayBetweenEmails, maxPerHour } =
      req.body as ScheduleEmailRequest;

    // Validation
    if (!subject || !body || !recipients || !senderEmail || !startTime) {
      res.status(400).json({
        error: 'Missing required fields: subject, body, recipients, senderEmail, startTime',
      });
      return;
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: 'recipients must be a non-empty array of email addresses' });
      return;
    }

    // Validate sender exists
    const sender = await prisma.sender.findUnique({ where: { email: senderEmail } });
    if (!sender) {
      res.status(400).json({ error: `Sender ${senderEmail} not found` });
      return;
    }

    const result = await scheduleEmailBatch(req.userId!, {
      subject,
      body,
      recipients,
      senderEmail,
      startTime,
      delayBetweenEmails: delayBetweenEmails || 2000,
      maxPerHour: maxPerHour || 50,
    });

    res.status(201).json({
      message: `Successfully scheduled ${result.count} email(s)`,
      batchId: result.batchId,
      count: result.count,
    });
  } catch (err: any) {
    console.error('[EmailRoutes] Schedule error:', err.message);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

/**
 * POST /api/emails/parse-csv
 * Parse a CSV/text file and return extracted email addresses.
 */
router.post('/parse-csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const content = req.file.buffer.toString('utf-8');
    const emails = parseEmailsFromContent(content);

    res.json({ emails, count: emails.length });
  } catch (err: any) {
    console.error('[EmailRoutes] Parse CSV error:', err.message);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

/**
 * GET /api/emails/scheduled
 * Get scheduled (pending/queued) emails with pagination.
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: {
          userId: req.userId,
          status: { in: ['PENDING', 'QUEUED', 'RATE_LIMITED'] },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.email.count({
        where: {
          userId: req.userId,
          status: { in: ['PENDING', 'QUEUED', 'RATE_LIMITED'] },
        },
      }),
    ]);

    const response: PaginatedResponse<EmailResponse> = {
      data: emails.map(mapEmailToResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    res.json(response);
  } catch (err: any) {
    console.error('[EmailRoutes] Scheduled list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * Get sent/failed emails with pagination.
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: {
          userId: req.userId,
          status: { in: ['SENT', 'FAILED', 'SENDING'] },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.email.count({
        where: {
          userId: req.userId,
          status: { in: ['SENT', 'FAILED', 'SENDING'] },
        },
      }),
    ]);

    const response: PaginatedResponse<EmailResponse> = {
      data: emails.map(mapEmailToResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    res.json(response);
  } catch (err: any) {
    console.error('[EmailRoutes] Sent list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/stats
 * Get email counts by status.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [scheduled, sent, failed] = await Promise.all([
      prisma.email.count({
        where: { userId: req.userId, status: { in: ['PENDING', 'QUEUED', 'RATE_LIMITED'] } },
      }),
      prisma.email.count({
        where: { userId: req.userId, status: 'SENT' },
      }),
      prisma.email.count({
        where: { userId: req.userId, status: 'FAILED' },
      }),
    ]);

    const stats: StatsResponse = {
      scheduled,
      sent,
      failed,
      total: scheduled + sent + failed,
    };

    res.json(stats);
  } catch (err: any) {
    console.error('[EmailRoutes] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/emails/senders
 * Get available senders.
 */
router.get('/senders', async (_req: Request, res: Response) => {
  try {
    const senders = await prisma.sender.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ senders });
  } catch (err: any) {
    console.error('[EmailRoutes] Senders list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

/**
 * GET /api/emails/:id
 * Get a single email by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json(mapEmailToResponse(email));
  } catch (err: any) {
    console.error('[EmailRoutes] Get email error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

/**
 * DELETE /api/emails/:id
 * Cancel a scheduled email.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    if (email.status === 'SENT') {
      res.status(400).json({ error: 'Cannot cancel an already sent email' });
      return;
    }

    await prisma.email.delete({ where: { id: email.id } });

    res.json({ message: 'Email cancelled successfully' });
  } catch (err: any) {
    console.error('[EmailRoutes] Delete email error:', err.message);
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});

// Helper to map Prisma Email to API response
function mapEmailToResponse(email: any): EmailResponse {
  return {
    id: email.id,
    recipientEmail: email.recipientEmail,
    senderEmail: email.senderEmail,
    subject: email.subject,
    body: email.body,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() || null,
    status: email.status,
    batchId: email.batchId,
    previewUrl: email.previewUrl || null,
    error: email.error || null,
    createdAt: email.createdAt.toISOString(),
  };
}

export default router;
