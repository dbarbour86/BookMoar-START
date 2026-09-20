# Book Moar START — $97/Month Template V1

Reusable, production-ready **single-client Book Moar START template** for local service businesses (auto detailers, roofers, contractors, movers, plumbers, etc.).

---

## 1. What Book Moar START Is

Book Moar START is a streamlined, lightning-fast CRM and response acceleration system designed for local service businesses.

The primary purpose of START is:
> **Capture incoming leads and help the business respond before those leads are lost.**

### $97/Month Scope:
- **Public Website Lead Intake**: Secure, abuse-protected REST endpoint (`POST /api/leads`) accepting inquiries from the client's marketing site.
- **Real-Time Owner Notifications**: Immediate SMS dispatch to the owner's phone when a new website lead arrives. Notification failures are isolated and never drop or reject a lead.
- **Lead Inbox**: Fast, mobile-first dashboard prioritizing actionable new inquiries with direct `tel:`, `sms:`, and `mailto:` triggers.
- **Lead Lifecycle State Machine**: Controlled transitions (`NEW` → `CONTACTED` → `CLOSED`, with `CLOSED` → `CONTACTED` reopening support) with timestamp tracking.
- **Missed-Call Recovery**: Twilio voice webhook forwarding calls to the business owner, analyzing the child leg's `DialCallStatus` outcome. If unanswered, busy, or failed, it automatically sends a recovery text-back and creates a `MISSED_CALL` lead.
- **Services Catalog**: Owner management of business services with prices stored in integer cents. Historical relationships are preserved when services are deactivated.
- **Business Profile**: Centralized configuration of business name, phones, timezone, and auto-text templates.

---

## 2. Architecture & Single-Client Isolation

**This is NOT a multi-tenant SaaS application.**

Each client receives an **isolated deployment**:
- `Apex Auto Detail`: `apexdetail.bookmoar.com` → isolated deployment + dedicated database.
- `Summit Roofing`: `summitroofing.bookmoar.com` → isolated deployment + dedicated database.

### Core Architectural Rules:
- Exactly **ONE** business and **ONE** owner account per deployment.
- **NO** tenant tables, tenant switching, or `businessId` parameters.
- **NO** Master Admin cross-client dashboards.
- **NO** SaaS billing or plan tiers in the database.
- All secrets remain strictly server-side.

---

## 3. Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL
- **ORM**: Prisma ORM with versioned SQL migrations
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Authentication**: `bcryptjs` (password hashing) + `jose` (HMAC-SHA256 signed HTTP-only session cookies)
- **Testing**: Vitest (28 unit & integration tests)

---

## 4. Local Setup & Quickstart

### Prerequisites
- Node.js 18+ (Tested on Node v20 & v26)
- Docker (for local PostgreSQL) or an existing PostgreSQL instance

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd Start
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Review the values in `.env`:
```ini
# Isolated Single-Client Database
DATABASE_URL="postgresql://bookmoar:bookmoar_password@localhost:5432/bookmoar_db?schema=public"

# Authentication Session Secret (32+ chars)
AUTH_SECRET="dev-insecure-secret-key-change-in-production-at-least-32-chars-long"

# Base URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Twilio (Optional in Dev - falls back to DevMockSmsProvider)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
TWILIO_RECOVERY_SMS_ENABLED="true"
TWILIO_OWNER_NOTIFICATIONS_ENABLED="true"
```

### 3. Start Local PostgreSQL Database
If using Docker:
```bash
docker run --name bookmoar-db -e POSTGRES_USER=bookmoar -e POSTGRES_PASSWORD=bookmoar_password -e POSTGRES_DB=bookmoar_db -p 5432:5432 -d postgres:16-alpine
```

### 4. Deploy Migrations & Seed Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Deploy versioned migrations to PostgreSQL
npm run prisma:deploy

# Seed development database with sample business & leads
npm run seed
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Development Credentials & Test Tools

- **Owner Portal Login**: [http://localhost:3000/login](http://localhost:3000/login)
  - **Email**: `owner@apexdetail.com`
  - **Password**: `Password123!`
- **Public Lead Intake Test Form**: [http://localhost:3000/test-lead](http://localhost:3000/test-lead)
  - Submits inquiries directly through `POST /api/leads`.

---

## 6. Twilio Missed-Call & Voice Configuration

### How Voice Forwarding & Missed-Call Recovery Works:
1. In Twilio Console, configure the client's Twilio Phone Number Voice Webhook:
   - **Request URL**: `https://<client-subdomain>.bookmoar.com/api/webhooks/twilio/voice`
   - **HTTP Method**: `POST`
2. When a caller dials the Twilio number, Book Moar returns TwiML instructing Twilio to dial the business owner's mobile phone with a 25-second timeout and an `action` callback to `/api/webhooks/twilio/dial-action`.
3. When the dial finishes, Twilio posts the dialed outcome (`DialCallStatus`) to `/api/webhooks/twilio/dial-action`.
4. **Outcome Evaluation**:
   - `DialCallStatus === "completed"`: The owner answered! **No SMS is sent.**
   - `DialCallStatus` is `no-answer`, `busy`, `failed`, or `canceled`: The call was missed. Book Moar sends the client's automated recovery SMS and logs a `MISSED_CALL` lead.
   - Duplicate callbacks for the same `CallSid` are deduplicated and will not send repeated SMS.

### Development Mock Provider:
When `TWILIO_ACCOUNT_SID` is omitted from `.env`, Book Moar automatically uses `DevMockSmsProvider`, which safely logs outbound SMS to the application console without attempting external network calls.

---

## 7. Automated Testing & Verification

Run the test suite:
```bash
npm test
```
The suite executes 28 tests across 5 test suites:
- `tests/auth.test.ts`: Password hashing, token signing, session verification, tampered token rejection.
- `tests/leads.test.ts`: Public lead intake, input validation, state machine transitions, timestamp tracking, repeated submission separation.
- `tests/services.test.ts`: Service creation, editing, active/inactive filtering, historical lead foreign-key preservation.
- `tests/notifications.test.ts`: Real-time owner notifications and fault-isolation (leads persist even if SMS fails).
- `tests/missed-call.test.ts`: Answered forwarded calls (no SMS), unanswered forwarded calls (SMS sent), busy/failed calls, `CallSid` deduplication, and open lead association.

Run linter:
```bash
npm run lint
```

Build for production:
```bash
npm run build
```

---

## 8. Functionality Intentionally Excluded in START V1

START V1 is laser-focused on lead capture and response speed. The following higher-tier features are **strictly excluded**:
- Multi-tenancy / tenant switching / Master Admin
- Appointment scheduling & booking calendar
- Automated booking confirmations & reminders
- Review requests & review gating
- Internal two-way SMS chat threads
- Mass texting & email marketing campaigns
- Payments & invoicing
- AI agents / bots
- Workflow / automation visual builders
- Employee / staff sub-accounts
- Database-driven client-facing feature toggles

---

## 9. Documentation Directory

- [`docs/architecture.md`](docs/architecture.md): Deep architectural details, module boundaries, deduplication logic, and security design.
- [`docs/offboarding.md`](docs/offboarding.md): Step-by-step procedure for exporting client data, disconnecting integrations, and removing Book Moar proprietary endpoints upon client departure.
