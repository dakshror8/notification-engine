# 🚀 Distributed Real-Time Notification Engine

An event-driven, fault-tolerant notification ingestion and delivery pipeline built with **TypeScript, Node.js, Express, Redis (BullMQ), and PostgreSQL (Prisma ORM)**. 

Designed to decouple high-throughput HTTP ingestion from slow downstream delivery operations (Email, SMS, Push), ensuring non-blocking API responses, strict payload validation, and idempotent processing under burst traffic.

## 🌐 Live Demo & Interactive Control Panel

* **Live Application:** [https://notification-engine-zzhf.onrender.com](https://notification-engine-zzhf.onrender.com)
* **Interactive UI (`GET /`):** Trigger test notifications, simulate duplicate client retries (`409 Conflict`), and inspect live database logs directly in your browser.
* **Audit Logs API (`GET /api/v1/notifications`):** View the 20 most recent persisted delivery records from Neon PostgreSQL.

> *Note: Hosted on Render's free tier—the initial request after 15 minutes of inactivity may take ~30 seconds to wake the container.*

---

## 🏗️ System Architecture

```text
[Client / Mobile App]
         │
         │  POST /api/v1/notifications
         │  Header: Idempotency-Key: <uuid>
         ▼
┌─────────────────────────────────────────┐
│        Express.js API Gateway           │
│  1. Zod Runtime Schema Validation       │
│  2. Redis Atomic Idempotency Check      │
└────────────────────┬────────────────────┘
                     │ Enqueue Job (202 Accepted)
                     ▼
        ┌─────────────────────────┐
        │   Redis / BullMQ Queue  │  ◄── Exponential Backoff Retries (3x)
        └────────────┬────────────┘
                     │ Async Consume
                     ▼
┌─────────────────────────────────────────┐
│     Background Delivery Worker (TS)     │
│  • Simulates External Provider I/O      │
│  • Updates Delivery Lifecycle Status    │
└────────────────────┬────────────────────┘
                     │ Persist Audit Log
                     ▼
        ┌─────────────────────────┐
        │  PostgreSQL (Prisma 8)  │
        └─────────────────────────┘
```

---

## ✨ Key Engineering Features

* **Asynchronous Task Decoupling:** API requests return `202 Accepted` in milliseconds by offloading heavy I/O tasks to background workers via **BullMQ** and **Redis**.
* **Idempotency Protection:** Enforces client-supplied `Idempotency-Key` headers using atomic Redis locks (`SET NX` with a 24-hour TTL) to prevent duplicate notifications during client network retries (`409 Conflict`).
* **Strict Runtime & Compile-Time Safety:** End-to-end TypeScript strict mode paired with **Zod** schema validation to reject malformed payloads (`400 Bad Request`) before they enter the queue.
* **Fault Tolerance & Retries:** Configured exponential backoff retry strategies in BullMQ to gracefully recover from transient downstream provider failures.
* **Automated Integration Testing:** Verified API validation, queue ingestion, and idempotency enforcement using **Vitest** and **Supertest**.

---

## 🛠️ Tech Stack

* **Runtime & Language:** Node.js, TypeScript (ESM)
* **API Framework:** Express.js
* **Validation:** Zod
* **Message Broker & Caching:** Redis (`node-redis`), BullMQ
* **Database & ORM:** PostgreSQL, Prisma ORM
* **Testing & Infrastructure:** Vitest, Supertest, Docker Compose

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v22+)
* Docker & Docker Compose (or local PostgreSQL & Redis instances)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com
cd notification-engine
npm install
```

### 2. Start Infrastructure (PostgreSQL & Redis)
```bash
docker compose up -d
```

### 3. Configure Environment Variables
Copy the example environment file and update your database credentials:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
DATABASE_URL="postgresql://postgres:password123@localhost:5432/notification_db?schema=public"
```

### 4. Emit Contract & Run Database Migrations
```bash
npx prisma contract emit
npx prisma db migrate --db "\$DATABASE_URL" --advance-ref db
```

### 5. Run the Application (Two Terminals)
**Terminal 1 — Start the API Gateway:**
```bash
npm run dev:server
```

**Terminal 2 — Start the Background Worker:**
```bash
npm run dev:worker
```

---

## 📡 API Reference

### Trigger a Notification
`POST /api/v1/notifications`

**Headers:**
* `Content-Type: application/json`
* `Idempotency-Key: <unique-uuid>` *(Optional, recommended for safe retries)*

**Request Body:**
```json
{
  "userId": "usr_101",
  "type": "EMAIL",
  "message": "Your payment of \$49.00 was successful."
}
```

**Responses:**
* `202 Accepted`: Notification validated and queued for background processing.
* `400 Bad Request`: Validation failed (invalid channel type or empty fields).
* `409 Conflict`: Duplicate request blocked by `Idempotency-Key`.

### Fetch Notification Logs
`GET /api/v1/notifications`
* Returns all persisted notification records and their delivery statuses from PostgreSQL.

---

## 🧪 Running Tests

Ensure Redis is running, then execute the integration test suite:
```bash
npm test
```
