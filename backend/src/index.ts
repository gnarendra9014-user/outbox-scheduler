import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import prisma from './db/prisma';
import { startEmailWorker, stopEmailWorker } from './queue/emailWorker';
import { emailQueue, redisConnection } from './queue/emailQueue';
import { closeRateLimiter } from './queue/rateLimiter';
import { seedEtherealSenders, clearTransporterCache } from './services/emailService';
import { recoverOrphanedJobs } from './services/schedulerService';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Startup ─────────────────────────────────────────────────
async function start() {
  try {
    // 1. Connect to database
    await prisma.$connect();
    console.log('[Server] ✅ Database connected');

    // 2. Seed Ethereal senders if none exist
    await seedEtherealSenders(3);

    // 3. Start the BullMQ worker
    startEmailWorker();

    // 4. Recover orphaned jobs (persistence after restart)
    const recovered = await recoverOrphanedJobs();
    if (recovered > 0) {
      console.log(`[Server] ✅ Recovered ${recovered} orphaned job(s) from previous session`);
    }

    // 5. Start Express server
    app.listen(config.port, () => {
      console.log(`\n🚀 Outbox Email Scheduler running at http://localhost:${config.port}`);
      console.log(`   Frontend URL: ${config.frontendUrl}`);
      console.log(`   Redis: ${config.redisUrl}`);
      console.log(`   Worker Concurrency: ${config.workerConcurrency}`);
      console.log(`   Email Delay: ${config.emailDelayMs}ms`);
      console.log(`   Max Emails/Hour: ${config.maxEmailsPerHour}`);
      console.log(`   Max Emails/Hour/Sender: ${config.maxEmailsPerHourPerSender}\n`);
    });
  } catch (err) {
    console.error('[Server] ❌ Failed to start:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  try {
    await stopEmailWorker();
    await emailQueue.close();
    await redisConnection.quit();
    await closeRateLimiter();
    clearTransporterCache();
    await prisma.$disconnect();
    console.log('[Server] ✅ Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[Server] ❌ Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
start();
