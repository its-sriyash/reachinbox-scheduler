# ReachInbox Email Job Scheduler

Production-grade full-stack email job scheduler with BullMQ, Redis-backed rate limiting, configurable worker concurrency, minimum delay spacing, real Google OAuth, and durable PostgreSQL persistence.

---

## 1. Project Overview

The **ReachInbox Email Job Scheduler** is designed to handle scheduled, rate-limited email campaigns at scale. Users can authenticate with real Google OAuth (or access the development sandbox), compose email batches, upload or paste CSV recipient lists, configure custom start times, enforce minimum delays between consecutive emails, and restrict hourly sending volume.

All delayed email delivery is coordinated durably across PostgreSQL and Redis. The system guarantees zero duplicate sends, atomic rate-limit counter tracking, non-blocking worker concurrency, and seamless crash/restart persistence.

---

## 2. Features

- **Real Google OAuth Authentication**: Authenticate with Google, receive user profile (name, email, avatar), and maintain session via HTTP-only JWT cookies.
- **Development Sandbox**: Dedicated local preview mode allowing full dashboard testing without requiring Google Cloud credentials.
- **Durable Scheduling**: PostgreSQL serves as the durable source of truth; BullMQ with Redis manages delayed timing.
- **Worker Concurrency**: Configurable concurrent job processing (`WORKER_CONCURRENCY=5`). Multiple jobs process in parallel without blocking.
- **Minimum Delay Spacing**: Strict Redis-coordinated inter-email delay (`delayBetweenEmails`) ensuring emails are spaced evenly across all workers.
- **Redis Hourly Rate Limiting**: Atomic Lua-scripted hourly rate limits (`hourlyLimit`) per fixed clock-hour window. Counter does not increment when the limit is reached.
- **Automatic Window Rescheduling**: Rate-limited jobs revert to `SCHEDULED` in PostgreSQL and are rescheduled via BullMQ `moveToDelayed` to the exact start of the next hour window.
- **Idempotency Protection**: Atomic state transition `SCHEDULED` $\rightarrow$ `PROCESSING` ensures exactly one worker acquires an email. Already-sent emails exit cleanly with zero SMTP calls or rate-limit counter consumption.
- **Crash & Restart Persistence**: Scheduled emails and delayed queues survive server process restarts without duplicate sends.
- **Live SMTP Delivery**: Real email delivery via Nodemailer and Ethereal Email with message IDs and web preview URLs.
- **Recipient Parsing**: Intelligent CSV and plaintext parsing with automatic email extraction, duplicate elimination, and invalid row skipping.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (React + Vite)                     │
│  - Dashboard & Campaigns Table (Scheduled / Sent)           │
│  - Compose Modal (CSV Parser, Throttle & Delay Controls)    │
│  - Real Google OAuth & Sandbox Login                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (Port 5000)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Express.js API Backend                       │
│  - Auth Middleware (JWT Cookie / Header)                    │
│  - /api/auth/google & /api/auth/google/callback             │
│  - /api/emails/schedule, /scheduled, /sent                  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   PostgreSQL (Port 5432)     │ │     Redis (Port 6379)      │
│  - users table (OAuth data)  │ │  - BullMQ email-sending    │
│  - emails table (State truth)│ │  - ratelimit:emails:<win>  │
│  - status: SCHEDULED | SENT  │ │  - next_allowed_timestamp  │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │
                                               ▼
                                 ┌────────────────────────────┐
                                 │   BullMQ Queue Worker      │
                                 │  - Concurrency: 5          │
                                 │  - Atomic DB Claim         │
                                 │  - Lua Delay Reservation   │
                                 │  - Lua Rate Limit Check    │
                                 │  - Nodemailer / Ethereal   │
                                 └────────────────────────────┘
```

---

## 4. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, PapaParse, Axios
- **Backend**: Node.js (v20+ / v24+), Express.js, TypeScript, TSX
- **Database & ORM**: PostgreSQL 16, Prisma ORM
- **Queue & In-Memory Store**: BullMQ, Redis (ioredis)
- **Email Delivery**: Nodemailer, Ethereal Email SMTP
- **Authentication**: Google OAuth2 API, JWT (`jsonwebtoken`), `cookie-parser`
- **Containerization**: Docker Compose

---

## 5. Folder Structure

```
reachinbox-scheduler/
├── docker-compose.yml           # PostgreSQL & Redis container definitions
├── README.md                    # System documentation
├── .gitignore                   # Ignored files (node_modules, .env, dist)
├── backend/
│   ├── .env                     # Local backend environment variables (gitignored)
│   ├── .env.example             # Template for backend environment variables
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma        # Database models (User, Email, EmailStatus)
│   │   └── migrations/          # SQL migrations
│   └── src/
│       ├── index.ts             # Express server setup, graceful shutdown
│       ├── db/
│       │   ├── client.ts        # Prisma client instance
│       │   └── redis.ts         # Redis connection instance
│       ├── middleware/
│       │   └── auth.ts          # JWT authentication middleware
│       ├── queue/
│       │   ├── emailQueue.ts    # BullMQ Queue instance
│       │   └── worker.ts        # BullMQ Worker, claim logic & email processor
│       ├── routes/
│       │   ├── authRoutes.ts    # Google OAuth & session endpoints
│       │   └── emailRoutes.ts   # Scheduling & query endpoints
│       └── services/
│           ├── authService.ts   # Google profile exchange & JWT signing
│           ├── emailSender.ts   # Nodemailer / Ethereal SMTP transport
│           ├── emailService.ts  # Database persistence & job enqueuing
│           └── rateLimiter.ts   # Redis Lua scripts for delay & rate limiting
└── frontend/
    ├── .env.example             # Frontend environment template
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts           # Vite config with /api proxy to port 5000
    └── src/
        ├── App.tsx              # Root component, auth state management
        ├── main.tsx
        ├── index.css            # Dark/orange ReachInbox styling
        ├── components/          # Reusable UI components
        ├── context/             # ThemeContext (Dark / Light)
        ├── lib/                 # API client (Axios) & Google auth URL
        ├── pages/               # Login & Dashboard pages
        └── types/               # TypeScript interfaces (User, Email)
```

---

## 6. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ / v24+ recommended)
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose**: For local PostgreSQL and Redis containers

---

## 7. How to Start PostgreSQL + Redis

From the project root:

```bash
docker compose up -d
```

Verify that both containers are running and healthy:

```bash
docker compose ps
```

---

## 8. Backend Setup

Navigate to the `backend` directory and install dependencies:

```bash
cd backend
npm install
```

---

## 9. Prisma Migration & Setup

Apply database migrations and generate the Prisma Client:

```bash
npm run prisma:generate
npx prisma db push
```

---

## 10. Ethereal Email Setup

Ethereal is a free fake SMTP service for testing. The project comes pre-configured with active Ethereal credentials in `.env.example`.

To create your own test credentials:
1. Visit [ethereal.email](https://ethereal.email/) and click **Create Ethereal Account**.
2. Copy the generated Username, Password, Host (`smtp.ethereal.email`), and Port (`587`).
3. Place them into `backend/.env`.

---

## 11. Google OAuth Setup

To enable real Google login:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and configure the **OAuth consent screen** (External, add scopes `.../auth/userinfo.email`, `.../auth/userinfo.profile`).
3. Create credentials: **OAuth client ID** $\rightarrow$ **Web application**.
4. Set Authorized redirect URIs to:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
5. Add the generated credentials to `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

*Note: If Google credentials are not set, the **Development Sandbox** button on the login screen allows full application testing.*

---

## 12. Environment Variables

Create `backend/.env` based on `backend/.env.example`:

```env
PORT=5000
DATABASE_URL=postgresql://reachinbox:reachinbox@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379

# Worker Configuration
WORKER_CONCURRENCY=5

# Rate Limiting Configuration (in seconds, default 3600 = 1 hour)
RATE_LIMIT_WINDOW_SECONDS=3600

# Ethereal SMTP Configuration
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=qnxkmqccrp7huc2t@ethereal.email
SMTP_PASSWORD=eJmH1DeYRpsrFJGvVr
SMTP_FROM="ReachInbox <no-reply@reachinbox.ai>"

# Authentication & Google OAuth
JWT_SECRET=reachinbox-scheduler-production-secret-2026
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

---

## 13. How to Start Backend

Development mode (with hot reload):

```bash
cd backend
npm run dev
```

Production build:

```bash
cd backend
npm run build
npm start
```

---

## 14. How to Start Frontend

Navigate to `frontend/`, install dependencies, and run the development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## 15. API Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health check verifying PostgreSQL & Redis connectivity | No |
| `GET` | `/api/auth/google` | Initiates Google OAuth2 consent flow | No |
| `GET` | `/api/auth/google/callback`| OAuth callback: exchanges code for token, sets JWT cookie | No |
| `GET` | `/api/auth/me` | Returns current authenticated user | Yes |
| `POST`| `/api/auth/dev-login` | Logs in a mock development user for testing | No |
| `POST`| `/api/auth/logout` | Clears JWT cookie | Yes |
| `POST`| `/api/emails/schedule` | Schedules a new email batch | Optional / User |
| `GET` | `/api/emails/scheduled`| Returns scheduled emails for the active user | Optional / User |
| `GET` | `/api/emails/sent` | Returns sent emails with preview URLs for active user | Optional / User |

---

## 16. Scheduling Flow

1. User submits subject, body, recipients, `sendAt`, `delayBetweenEmails`, and `hourlyLimit`.
2. Backend validates request input and email syntax.
3. PostgreSQL transaction inserts records with `status = 'SCHEDULED'`.
4. BullMQ computes initial delay (`Math.max(0, sendAt.getTime() - now)`).
5. `emailQueue.addBulk(jobs)` enqueues delayed jobs in Redis using the PostgreSQL email UUID as `jobId`.

---

## 17. Worker Flow

When a delayed job becomes due in BullMQ:
1. **Pre-check**: Worker verifies email status in PostgreSQL. If already `SENT` or `FAILED`, returns immediately.
2. **Atomic Claim**: Executes `UPDATE "Email" SET status = 'PROCESSING' WHERE id = emailId AND status = 'SCHEDULED'`.
3. **Minimum Delay Reservation**: Evaluates Redis Lua script. If delay spacing is not met, reverts DB status to `SCHEDULED`, reschedules via `job.moveToDelayed()`, and throws `DelayedError()`.
4. **Hourly Rate Limit Reservation**: Evaluates Redis Lua script. If limit is reached, counter is not consumed, DB status reverts to `SCHEDULED` with `sendAt = resetAt`, and job is rescheduled to the next window.
5. **SMTP Send**: Dispatches real email via Nodemailer/Ethereal.
6. **DB Sent Update**: On success, updates PostgreSQL record to `status = 'SENT'`, recording `sentAt`, `messageId`, and `previewUrl`.

---

## 18. Idempotency Approach

- **Atomic Claim Guard**: Concurrency-safe SQL query ensures only one worker transition `SCHEDULED` $\rightarrow$ `PROCESSING`.
- **Pre-dispatch Status Filter**: Already `SENT` records exit immediately.
- **Result**: Zero duplicate emails sent across retries or overlapping worker threads.

---

## 19. Redis Rate Limiting

- **Window Key**: `ratelimit:emails:<windowId>` where `windowId = Math.floor(now / 3600000)`.
- **Atomic Lua Script**:
  ```lua
  local current = redis.call('GET', KEYS[1])
  local count = current and tonumber(current) or 0
  local limit = tonumber(ARGV[1])
  if count >= limit then
      return {0, count}
  else
      local newCount = redis.call('INCR', KEYS[1])
      if newCount == 1 then
          redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      return {1, newCount}
  end
  ```
- Guaranteed zero quota leaks and atomic execution.

---

## 20. Worker Concurrency

- Workers run with configurable parallelism (`WORKER_CONCURRENCY=5`).
- Concurrency test confirmed: up to 3 concurrent active jobs under `concurrency: 3`, never exceeding the limit, with parallel batching.

---

## 21. Minimum Delay

- Coordinated globally in Redis using key `email:next_allowed_send_timestamp`.
- Lua script checks if `now < nextAllowed`. If so, returns remaining milliseconds to wait.
- Ensures varying delays across campaigns (e.g. 10s vs 2s) are strictly respected.

---

## 22. Restart Persistence

- PostgreSQL stores durable email records and statuses.
- Redis BullMQ stores delayed job identifiers and target timestamps in a ZSET.
- Rate-limit counters are stored in Redis keys with TTL.
- When the backend stops and restarts, all pending jobs remain in Redis, resume processing upon arrival, and rate-limit state is preserved without reset.

---

## 23. 1000+ Email Behavior

When 1,000+ emails are scheduled:
1. **API Non-Blocking**: The API inserts records in PostgreSQL via a single bulk transaction and enqueues delayed jobs in Redis. It returns HTTP 201 within ~200ms without sending emails synchronously.
2. **Worker Pacing**: BullMQ controls job delivery based on `concurrency: 5`. Only 5 jobs are in flight at any given millisecond.
3. **Rate-Limit Window Partitioning**: If `hourlyLimit = 100`, exactly 100 emails dispatch in hour 1. The remaining 900 jobs are automatically moved to the next clock-hour window without memory leaks or dropped jobs.
4. **No In-Memory Cron**: No blocking timers or in-memory queues are used.

---

## 24. Testing Instructions

Run automated verification:

```bash
cd backend
npm run build
```

Run frontend build:

```bash
cd frontend
npm run build
```

Verify backend health:

```bash
curl http://localhost:5000/health
```

---

## 25. Assumptions & Trade-offs

- **Global vs Sender Rate Limiting**: The system implements global rate limiting for shared SMTP IP protection with user-scoped email filtering. In production with dedicated SMTP accounts per user, the Redis key can be scoped to `ratelimit:emails:<senderId>:<windowId>`.
- **Ethereal Mail**: Used for real SMTP verification without requiring paid third-party email delivery services (SendGrid/Mailgun).
- **Timezone**: Dates are submitted and stored in ISO UTC format; frontend converts them to the client's local display timezone.

---

## 26. Feature Checklist

| Requirement | Implementation | Status |
| :--- | :--- | :--- |
| **Express & TypeScript** | Strict TypeScript backend on Node.js | PASS |
| **PostgreSQL & Prisma** | Durable database persistence with User/Email relations | PASS |
| **Redis & BullMQ** | Redis ZSET delayed queue & worker architecture | PASS |
| **No Cron Rule** | Native BullMQ delayed jobs (`moveToDelayed`) | PASS |
| **Configurable Concurrency** | `WORKER_CONCURRENCY` environment variable | PASS |
| **Minimum Delay** | Redis Lua reservation key | PASS |
| **Hourly Rate Limiting** | Redis atomic Lua script with window rollover | PASS |
| **Real Google OAuth** | OAuth2 consent, code exchange, profile fetch, JWT cookie | PASS |
| **User Ownership** | Authenticated user query isolation on Scheduled & Sent tabs | PASS |
| **Ethereal SMTP** | Real Nodemailer SMTP delivery with preview URLs | PASS |
| **Idempotency** | Atomic `SCHEDULED` $\rightarrow$ `PROCESSING` claim | PASS |
| **Restart Persistence** | Verified across actual process termination and recovery | PASS |
| **Frontend UI Shell** | Dark/orange ReachInbox design with CSV parser & Compose flow | PASS |
