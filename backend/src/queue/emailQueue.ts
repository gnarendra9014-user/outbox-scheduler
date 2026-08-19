import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { EmailJobData } from '../types';

// Create a shared Redis connection for the queue
export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

// Create the email queue
export const emailQueue = new Queue<EmailJobData>('email-send', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400,   // Keep completed jobs for 24 hours
      count: 5000,  // Keep at most 5000 completed jobs
    },
    removeOnFail: {
      age: 604800,  // Keep failed jobs for 7 days
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Add an email job to the queue with a specific delay.
 */
export async function addEmailJob(
  emailId: string,
  senderEmail: string,
  delayMs: number,
  maxPerHour: number
): Promise<string> {
  const job = await emailQueue.add(
    'send-email',
    {
      emailId,
      senderEmail,
      maxPerHour,
    },
    {
      delay: Math.max(0, delayMs),
      jobId: `email-${emailId}`, // Ensures idempotency — same emailId = same job
    }
  );

  return job.id!;
}

/**
 * Check if a job exists in the queue (not yet completed/failed).
 */
export async function jobExists(emailId: string): Promise<boolean> {
  const jobId = `email-${emailId}`;
  const job = await emailQueue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  return state !== 'completed' && state !== 'failed' && state !== 'unknown';
}
