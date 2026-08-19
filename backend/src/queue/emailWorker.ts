import { Worker, Job, UnrecoverableError } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { EmailJobData } from '../types';
import { checkSenderRateLimit, checkGlobalRateLimit } from './rateLimiter';
import { sendEmailViaSMTP } from '../services/emailService';
import prisma from '../db/prisma';

let worker: Worker<EmailJobData> | null = null;

/**
 * Sleep utility for inter-email delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize the BullMQ worker to process email jobs.
 *
 * Concurrency is configurable via WORKER_CONCURRENCY env var.
 * Rate limiting is enforced per-sender and globally via Redis.
 * A minimum delay (EMAIL_DELAY_MS) is applied between sends to mimic provider throttling.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  const workerConnection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  worker = new Worker<EmailJobData>(
    'email-send',
    async (job: Job<EmailJobData>) => {
      const { emailId, senderEmail, maxPerHour } = job.data;

      console.log(`[Worker] Processing job ${job.id} for email ${emailId}`);

      // 1. Fetch the email from DB
      const email = await prisma.email.findUnique({
        where: { id: emailId },
      });

      if (!email) {
        console.warn(`[Worker] Email ${emailId} not found in DB — skipping`);
        throw new UnrecoverableError(`Email ${emailId} not found`);
      }

      // 2. Idempotency check — don't re-send already sent emails
      if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} already sent — skipping`);
        return { skipped: true, reason: 'already_sent' };
      }

      // 3. Check global rate limit
      const globalLimit = await checkGlobalRateLimit();
      if (!globalLimit.allowed) {
        console.log(
          `[Worker] Global rate limit reached (${globalLimit.currentCount}/${config.maxEmailsPerHour}). ` +
          `Retrying in ${globalLimit.retryAfterMs}ms`
        );
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'RATE_LIMITED' },
        });
        // Move job back with delay — BullMQ will re-process after the delay
        await job.moveToDelayed(Date.now() + globalLimit.retryAfterMs!, job.token);
        // Return without throwing to prevent retry count increment
        throw new Error(`RATE_LIMITED:${globalLimit.retryAfterMs}`);
      }

      // 4. Check per-sender rate limit
      const perSenderLimit = maxPerHour || config.maxEmailsPerHourPerSender;
      const senderLimit = await checkSenderRateLimit(senderEmail, perSenderLimit);
      if (!senderLimit.allowed) {
        console.log(
          `[Worker] Sender ${senderEmail} rate limit reached (${senderLimit.currentCount}/${perSenderLimit}). ` +
          `Retrying in ${senderLimit.retryAfterMs}ms`
        );
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'RATE_LIMITED' },
        });
        await job.moveToDelayed(Date.now() + senderLimit.retryAfterMs!, job.token);
        throw new Error(`RATE_LIMITED:${senderLimit.retryAfterMs}`);
      }

      // 5. Apply inter-email delay (mimics provider throttling)
      if (config.emailDelayMs > 0) {
        await sleep(config.emailDelayMs);
      }

      // 6. Update status to SENDING
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'SENDING' },
      });

      // 7. Send via Ethereal SMTP
      try {
        const result = await sendEmailViaSMTP(
          senderEmail,
          email.recipientEmail,
          email.subject,
          email.body
        );

        // 8. Update DB with success
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            previewUrl: result.previewUrl,
            etherealMessageId: result.messageId,
          },
        });

        console.log(
          `[Worker] ✅ Email ${emailId} sent to ${email.recipientEmail}. ` +
          `Preview: ${result.previewUrl}`
        );

        return { success: true, previewUrl: result.previewUrl };
      } catch (sendError: any) {
        // 9. Update DB with failure
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            error: sendError.message || 'Unknown SMTP error',
          },
        });

        console.error(`[Worker] ❌ Failed to send email ${emailId}:`, sendError.message);
        throw sendError; // Let BullMQ handle retries
      }
    },
    {
      connection: workerConnection,
      concurrency: config.workerConcurrency,
      limiter: {
        max: config.maxEmailsPerHour,
        duration: 3600000, // 1 hour in ms
      },
    }
  );

  // Worker event listeners
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job?.id} completed`);
  });

  worker.on('failed', (job, err) => {
    if (err.message.startsWith('RATE_LIMITED:')) {
      // Don't log rate-limited jobs as errors — they'll be retried
      return;
    }
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
  });

  console.log(
    `[Worker] Started with concurrency=${config.workerConcurrency}, ` +
    `globalLimit=${config.maxEmailsPerHour}/hr, ` +
    `senderLimit=${config.maxEmailsPerHourPerSender}/hr, ` +
    `delay=${config.emailDelayMs}ms`
  );

  return worker;
}

/**
 * Gracefully shutdown the worker.
 */
export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    worker = null;
    console.log('[Worker] Shutdown complete');
  }
}
