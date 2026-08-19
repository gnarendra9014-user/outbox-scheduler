# 🚀 Outbox — Production-Grade Email Job Scheduler

A full-stack email scheduling service with a React dashboard. Built with **Express.js + BullMQ + PostgreSQL** on the backend and **Vite + React + Tailwind CSS** on the frontend.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Setup & Running](#-setup--running)
- [Ethereal Email Setup](#-ethereal-email-setup)
- [Google OAuth Setup](#-google-oauth-setup)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Scheduling & Persistence](#-scheduling--persistence)
- [Rate Limiting & Concurrency](#-rate-limiting--concurrency)
- [Feature Checklist](#-feature-checklist)
- [Assumptions & Trade-offs](#-assumptions--trade-offs)

---

## ✅ Features

### Backend
- ✅ Email scheduling via REST API
- ✅ BullMQ delayed jobs (no cron)
- ✅ PostgreSQL persistence (Prisma ORM)
- ✅ Ethereal Email (fake SMTP) for testing
- ✅ Multiple sender support
- ✅ Configurable worker concurrency
- ✅ Per-sender + global Redis-backed rate limiting
- ✅ Configurable inter-email delay (min 2 seconds between sends)
- ✅ Restart persistence — future emails survive server restarts
- ✅ Idempotency — emails are never sent twice
- ✅ Graceful shutdown
- ✅ CSV file parsing for email recipients

### Frontend
- ✅ Google OAuth login (real)
- ✅ User info display (name, email, avatar) + logout
- ✅ Dashboard with Scheduled / Sent tabs
- ✅ Compose New Email modal with CSV upload
- ✅ Stats cards (scheduled, sent, failed, total)
- ✅ Email tables with pagination
- ✅ Loading skeletons & empty states
- ✅ Toast notifications for success/error
- ✅ Dark theme with glassmorphism design
- ✅ Reusable UI component library

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript, Express.js |
| Queue | BullMQ (Redis-backed) |
| Database | PostgreSQL 15 (Prisma ORM) |
| SMTP | Ethereal Email (Nodemailer) |
| Auth | Google OAuth 2.0, JWT |
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Infra | Docker Compose |

---

## 🏗 Architecture Overview

### Scheduling Flow

```
User → Compose Modal → POST /api/emails/schedule
  → Creates Email records in PostgreSQL (status: PENDING)
  → Calculates delay: startTime + (index × delayBetweenEmails) - now
  → Adds BullMQ delayed jobs with calculated delay
  → Updates status to QUEUED in DB
```

### Processing Flow (Worker)

```
BullMQ Worker picks up job when delay expires
  → Check global rate limit (Redis counter)
  → Check per-sender rate limit (Redis counter)
  → If rate-limited → throw RateLimitError → BullMQ auto-reschedules
  → Apply inter-email delay (configurable, default 2s)
  → Send via Ethereal SMTP (Nodemailer)
  → Update DB: status=SENT, sentAt, previewUrl
  → On failure: status=FAILED, store error message
```

### Persistence & Restart Recovery

```
Server starts up
  → Connect to Redis + PostgreSQL
  → Query DB: emails WHERE status IN ('QUEUED','PENDING','RATE_LIMITED') AND scheduledAt > NOW()
  → For each orphaned email: check if BullMQ job still exists in Redis
  → If job missing: re-enqueue with correct delay (scheduledAt - now)
  → Past-due emails: enqueue immediately (delay = 0)
  → Already-sent emails (status=SENT) are NEVER re-sent (idempotency)
```

### Rate Limiting Architecture

```
Per-Sender Rate Limit:
  Redis key: "rate:sender:{email}:{hourWindow}"
  hourWindow = Math.floor(Date.now() / 3600000)
  Atomic INCR + EXPIRE via Lua script
  When limit reached → calculate delay to next hour → reschedule job

Global Rate Limit:
  Redis key: "rate:global:{hourWindow}"
  Same mechanism as per-sender
  BullMQ worker limiter also enforces global cap
```

---

## 🚀 Setup & Running

### Prerequisites
- Node.js 18+
- Docker (for Redis + PostgreSQL)
- Google Cloud project (for OAuth)

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd outbox
```

### 2. Start Infrastructure (Docker)

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379) with persistent volumes.

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Google OAuth credentials (see below)
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The backend starts at `http://localhost:3001`.

On first run, it automatically creates 3 Ethereal test sender accounts.

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

The Vite dev server proxies `/api` requests to the backend.

---

## 📧 Ethereal Email Setup

**No manual setup required!** The backend automatically creates Ethereal test accounts on first startup using `nodemailer.createTestAccount()`.

These accounts are stored in the `senders` table. You can view the sender credentials in the database.

Every email sent via Ethereal generates a **preview URL** (visible in the "Sent" tab) where you can view the rendered email in your browser.

---

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**
8. Paste them in `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/outbox` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `GOOGLE_CLIENT_ID` | — | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` | OAuth callback URL |
| `JWT_SECRET` | — | Secret for signing JWTs |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL (for CORS + redirects) |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent BullMQ workers |
| `EMAIL_DELAY_MS` | `2000` | Minimum delay between email sends (ms) |
| `MAX_EMAILS_PER_HOUR` | `200` | Global hourly email limit |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | Per-sender hourly email limit |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/google` | Redirect to Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback handler |
| `GET` | `/api/auth/me` | Get current user (requires auth) |
| `POST` | `/api/auth/logout` | Clear auth cookie |

### Emails (all require authentication)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/emails/schedule` | Schedule a batch of emails |
| `POST` | `/api/emails/parse-csv` | Parse CSV file for email addresses |
| `GET` | `/api/emails/scheduled` | List scheduled emails (paginated) |
| `GET` | `/api/emails/sent` | List sent emails (paginated) |
| `GET` | `/api/emails/stats` | Get email counts by status |
| `GET` | `/api/emails/senders` | List available senders |
| `GET` | `/api/emails/:id` | Get single email details |
| `DELETE` | `/api/emails/:id` | Cancel a scheduled email |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |

---

## 🔄 Scheduling & Persistence

### How Scheduling Works
1. User submits a batch via the Compose modal (or API)
2. Backend creates one `Email` record per recipient in PostgreSQL
3. Each email gets a calculated `scheduledAt` time: `startTime + (index × delay)`
4. BullMQ delayed jobs are created with `delay = scheduledAt - now`
5. BullMQ stores these in Redis sorted sets; the scheduler monitors and promotes them to "waiting" when the delay expires
6. The worker picks up jobs and sends via Ethereal SMTP

### Persistence on Restart
- **Redis stores the jobs**: Even if the server restarts, delayed jobs persist in Redis
- **DB is the source of truth**: On startup, the server queries PostgreSQL for orphaned jobs (status `QUEUED`/`PENDING` but no active BullMQ job)
- **Re-enqueue missing jobs**: Any orphaned job gets re-added to BullMQ with the correct remaining delay
- **Idempotency**: Jobs use `jobId: email-{emailId}` which prevents duplicates. The worker also checks `email.status === 'SENT'` before sending.

### No Cron Jobs
- ❌ No `node-cron`, `agenda`, or `crontab`
- ✅ BullMQ delayed jobs handle all scheduling
- ✅ Redis sorted sets track delayed job execution times

---

## ⚡ Rate Limiting & Concurrency

### Worker Concurrency
- Configured via `WORKER_CONCURRENCY` (default: 5)
- BullMQ processes up to N jobs in parallel
- All operations are safe for parallel execution (atomic Redis ops, DB transactions)

### Delay Between Emails
- Minimum 2-second delay between sends (configurable via `EMAIL_DELAY_MS`)
- Applied in the worker as a `sleep()` before each SMTP send
- Mimics real provider throttling

### Emails Per Hour (Rate Limiting)
- **Global**: `MAX_EMAILS_PER_HOUR=200` — limits total emails across all senders
- **Per-sender**: `MAX_EMAILS_PER_HOUR_PER_SENDER=50` — limits each sender independently
- **Implementation**: Redis atomic counters with Lua scripts
  - Key: `rate:sender:{email}:{hourWindow}` where `hourWindow = Math.floor(Date.now() / 3600000)`
  - Atomic `INCR` + `EXPIRE` (TTL = 3600s)
  - Safe across multiple workers/instances

### When Rate Limit is Reached
- Jobs are **NOT dropped or permanently failed**
- The job is delayed until the next hour window starts
- `job.moveToDelayed(nextHourStart)` pushes it back into the BullMQ delayed set
- Order is preserved as much as possible (FIFO within the same priority)

### Behavior Under Load (1000+ emails)
- All 1000 emails get DB records and BullMQ delayed jobs
- Rate limiter gates sending to `MAX_EMAILS_PER_HOUR` per hour
- Excess jobs auto-delay to the next available hour window
- With default settings (200/hr global, 50/hr per sender):
  - 1000 emails from 1 sender: ~20 hours (50/hr)
  - 1000 emails from 4 senders: ~5 hours (200/hr global cap)

---

## ✅ Feature Checklist

### Backend
| Feature | Status |
|---------|--------|
| Email scheduling via API | ✅ |
| BullMQ delayed jobs (no cron) | ✅ |
| PostgreSQL persistence (Prisma) | ✅ |
| Ethereal Email SMTP | ✅ |
| Multiple sender support | ✅ |
| Worker concurrency (configurable) | ✅ |
| Inter-email delay (min 2s) | ✅ |
| Per-sender rate limiting (Redis) | ✅ |
| Global rate limiting (Redis + BullMQ) | ✅ |
| Restart persistence (orphan recovery) | ✅ |
| Idempotency (no duplicates) | ✅ |
| Graceful shutdown | ✅ |
| CSV parsing | ✅ |

### Frontend
| Feature | Status |
|---------|--------|
| Google OAuth login (real) | ✅ |
| User info + avatar + logout | ✅ |
| Dashboard with tabs | ✅ |
| Compose New Email modal | ✅ |
| CSV file upload + email detection | ✅ |
| Schedule settings (start time, delay, limit) | ✅ |
| Scheduled emails table | ✅ |
| Sent emails table | ✅ |
| Ethereal preview links | ✅ |
| Loading states (skeletons) | ✅ |
| Empty states | ✅ |
| Error handling (toasts) | ✅ |
| Pagination | ✅ |
| Stats cards | ✅ |
| Reusable UI components | ✅ |
| TypeScript types/interfaces | ✅ |

---

## 📝 Assumptions & Trade-offs

1. **Ethereal accounts auto-created**: The backend seeds 3 Ethereal sender accounts on first run. In production, you'd have real SMTP credentials per sender.

2. **Rate limit precision**: The hourly window is based on wall-clock hours (Math.floor(Date.now() / 3600000)), not rolling windows. This is simpler and sufficient for this use case.

3. **BullMQ limiter + custom Redis limiter**: We use BullMQ's built-in `limiter` option for global throughput control AND a custom Redis-based rate limiter for per-sender limits. This provides defense in depth.

4. **Job recovery on restart**: We query the DB on startup to find orphaned jobs. This is safe because we use idempotent job IDs (`email-{emailId}`) and check the `status` column before sending.

5. **No real email delivery**: All emails go through Ethereal's fake SMTP. Preview URLs let you view rendered emails.

6. **JWT in both cookie and header**: The auth system supports both HTTP-only cookies (set by OAuth callback) and Bearer tokens (for API calls from the SPA).

7. **Single-process worker**: The worker runs in the same Node.js process as the Express server for simplicity. In production, you'd run workers as separate processes.

---

## 🎬 Demo Video Scenarios

1. **Login**: Sign in with Google → redirected to dashboard
2. **Compose**: Click "Compose New Email" → fill form → upload CSV → schedule
3. **Dashboard**: See emails in "Scheduled" tab → watch them move to "Sent" tab
4. **Preview**: Click Ethereal preview links to view sent emails
5. **Restart test**: Stop the server (Ctrl+C) → start again (`npm run dev`) → verify future emails still send
6. **Rate limiting**: Schedule 100+ emails → observe throttling in server logs
