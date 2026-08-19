import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/prisma';
import { addEmailJob, jobExists } from '../queue/emailQueue';
import { ScheduleEmailRequest } from '../types';

/**
 * Schedule a batch of emails.
 *
 * 1. Creates Email records in PostgreSQL with status PENDING
 * 2. Calculates delay for each email: startTime + (index × delayBetweenEmails)
 * 3. Adds BullMQ delayed jobs
 * 4. Updates status to QUEUED
 */
export async function scheduleEmailBatch(
  userId: string,
  request: ScheduleEmailRequest
): Promise<{ batchId: string; count: number }> {
  const batchId = uuidv4();
  const startTime = new Date(request.startTime).getTime();
  const now = Date.now();

  console.log(
    `[Scheduler] Scheduling batch ${batchId}: ${request.recipients.length} emails, ` +
    `start=${request.startTime}, delay=${request.delayBetweenEmails}ms`
  );

  // Create all email records in a transaction
  const emails = await prisma.$transaction(
    request.recipients.map((recipient, index) => {
      const scheduledAt = new Date(startTime + index * request.delayBetweenEmails);

      return prisma.email.create({
        data: {
          userId,
          recipientEmail: recipient,
          senderEmail: request.senderEmail,
          subject: request.subject,
          body: request.body,
          scheduledAt,
          status: 'PENDING',
          batchId,
        },
      });
    })
  );

  // Enqueue all jobs
  for (const email of emails) {
    const delayMs = email.scheduledAt.getTime() - now;
    const jobId = await addEmailJob(
      email.id,
      email.senderEmail,
      delayMs,
      request.maxPerHour || 50
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { status: 'QUEUED', jobId },
    });
  }

  console.log(`[Scheduler] ✅ Batch ${batchId} scheduled: ${emails.length} emails`);

  return { batchId, count: emails.length };
}

/**
 * Re-enqueue orphaned jobs on server restart.
 *
 * Finds all emails with status QUEUED or PENDING that are scheduled in the future,
 * checks if their BullMQ job still exists in Redis, and re-creates any missing jobs.
 * This ensures persistence across server restarts without duplicating already-queued jobs.
 */
export async function recoverOrphanedJobs(): Promise<number> {
  const now = new Date();

  // Find emails that should still be sent (future scheduled, not yet sent)
  const orphanedEmails = await prisma.email.findMany({
    where: {
      status: { in: ['QUEUED', 'PENDING', 'RATE_LIMITED'] },
      scheduledAt: { gt: now },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  if (orphanedEmails.length === 0) {
    console.log('[Scheduler] No orphaned jobs found');
    return 0;
  }

  console.log(`[Scheduler] Found ${orphanedEmails.length} potentially orphaned email(s)`);

  let recoveredCount = 0;

  for (const email of orphanedEmails) {
    // Check if the BullMQ job still exists
    const exists = await jobExists(email.id);

    if (!exists) {
      // Re-enqueue with correct delay
      const delayMs = email.scheduledAt.getTime() - Date.now();

      if (delayMs > 0) {
        const jobId = await addEmailJob(email.id, email.senderEmail, delayMs, 50);
        await prisma.email.update({
          where: { id: email.id },
          data: { status: 'QUEUED', jobId },
        });
        recoveredCount++;
        console.log(
          `[Scheduler] Recovered email ${email.id} → scheduled in ${Math.round(delayMs / 1000)}s`
        );
      }
    }
  }

  // Also handle emails whose scheduled time has passed while server was down
  const pastDueEmails = await prisma.email.findMany({
    where: {
      status: { in: ['QUEUED', 'PENDING', 'RATE_LIMITED'] },
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  for (const email of pastDueEmails) {
    const exists = await jobExists(email.id);
    if (!exists) {
      // Schedule immediately (delay = 0)
      const jobId = await addEmailJob(email.id, email.senderEmail, 0, 50);
      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'QUEUED', jobId },
      });
      recoveredCount++;
      console.log(`[Scheduler] Recovered past-due email ${email.id} → sending immediately`);
    }
  }

  console.log(`[Scheduler] ✅ Recovered ${recoveredCount} orphaned job(s)`);
  return recoveredCount;
}
