# Book Moar START V1 — Architecture & System Design

## 1. Overview & Core Philosophy

**Book Moar START** is a reusable, single-client CRM and lead-acceleration template for local service businesses (auto detailers, roofers, contractors, movers, plumbers, etc.) at the \$97/month tier.

The single, primary objective of START is:
> **Capture incoming leads and help the business respond before those leads are lost.**

### Single Business Per Deployment
START is **NOT** a multi-tenant SaaS application. There are:
- NO tenant tables or `tenantId` columns.
- NO `businessId` parameters accepted from the browser or URL query.
- NO Master Admin cross-client dashboards.
- NO client-facing feature toggles or plugin frameworks.
- NO subscription billing or SaaS plan tables in the database.

Each client receives an **isolated production deployment** with its own database, its own environment variables, and its own integration credentials. apexdetail.bookmoar.com and summitroofing.bookmoar.com run entirely separate instances with zero shared application data.

---

## 2. Logical Module Boundaries

All business logic is organized into clean, maintainable module boundaries in `src/modules/`. This modularity allows future template upgrades without rewriting the core application.

```
src/
├── modules/
│   ├── dashboard/      # Timezone-aware daily operations metrics & summary lists
│   ├── appointments/   # Appointment model, scheduling, service snapshotting & lifecycle
│   ├── leads/          # Lead intake, validation, deduplication rules, and lifecycle transitions
│   ├── services/       # Service catalog (create, edit, activate/deactivate)
│   ├── notifications/  # Owner SMS alerts via Twilio or DevMockLogger (fault-isolated)
│   ├── missed-call/    # Inbound voice forwarding, DialCallStatus analysis, text-back recovery
│   └── business/       # Single business profile configuration
└── lib/
    ├── db.ts           # Prisma client singleton
    ├── auth.ts         # Secure password hashing (bcrypt) & signed session cookie (jose)
    ├── phone.ts        # E.164 phone normalization & formatting
    └── errors.ts       # Standardized API error responses
```

### Module Responsibilities:

1. **`dashboard` (`src/modules/dashboard`)**:
   - Calculates operational metrics for the authenticated business owner in the configured `Business.timezone`.
   - Computes **New Leads** count, **Today's Appointments** remaining count, **Booked Value — Today**, and **Booked This Week**.
   - Filters **Today's Appointments** operational list: includes `SCHEDULED`, `COMPLETED`, and `NO_SHOW` (strictly excluding `CANCELED`).
   - Fetches recent actionable `NEW` leads.

2. **`appointments` (`src/modules/appointments`)**:
   - Manages the `Appointment` model (`SCHEDULED`, `COMPLETED`, `CANCELED`, `NO_SHOW`).
   - Snapshots `Service.name` into `Appointment.serviceName` at time of booking to preserve historical integrity against future service catalog changes.
   - Populates initial `Appointment.valueCents` from `Service.defaultPriceCents`, allowing custom job overrides without mutating the underlying service.
   - When booked from a Lead (`leadId`): transitions `NEW` leads to `CONTACTED` (with `contactedAt`) while preserving the permanent Lead record.
   - Allows manual appointment creation without a prior Lead.
   - Enforces valid outcome transitions: `SCHEDULED` &rarr; `COMPLETED`, `CANCELED`, or `NO_SHOW`.

3. **`leads` (`src/modules/leads`)**:
   - Manages the `Lead` model (`NEW`, `CONTACTED`, `CLOSED`).
   - Enforces the lifecycle state machine:
     - `NEW` &rarr; `CONTACTED` (sets `contactedAt = now()`)
     - `NEW` &rarr; `CLOSED` (sets `closedAt = now()`)
     - `CONTACTED` &rarr; `CLOSED` (sets `closedAt = now()`)
     - `CLOSED` &rarr; `CONTACTED` (reopening a closed lead; sets `contactedAt = now()`, resets `closedAt = null`)
     - Any other transition is rejected with a `400 Bad Request`.
   - Manages public website intake validation via Zod with honeypot abuse protection (`website_hp`).
   - Dispatches owner notifications asynchronously upon intake.

2. **`services` (`src/modules/services`)**:
   - Manages the business service catalog.
   - Provides public listing of *active* services only.
   - Provides owner listing of all services (active + inactive).
   - Enforces integer cents (`defaultPriceCents`) for monetary values.
   - Preserves historical foreign-key relationships on leads even when a service is deactivated (`onDelete: SetNull`).

3. **`notifications` (`src/modules/notifications`)**:
   - Uses a Provider pattern (`SmsProvider` interface).
   - Implementations: `TwilioSmsProvider` (production Twilio REST API) and `DevMockSmsProvider` (local dev/test logging).
   - **Critical Fault-Isolation Rule**: Notification failures (e.g. network failure, invalid Twilio auth, carrier drop) are logged but will **NEVER** abort, rollback, or reject an otherwise valid customer lead.

4. **`missed-call` (`src/modules/missed-call`)**:
   - Generates TwiML for inbound calls to forward to the owner's phone with a 25-second timeout and `<Dial action="/api/webhooks/twilio/dial-action">`.
   - Evaluates the dialed leg's outcome using `DialCallStatus`.
   - Dispatches recovery SMS if the business did not answer.
   - Enforces `CallSid` idempotency.

5. **`business` (`src/modules/business`)**:
   - Manages the single `Business` record for the deployed instance.
   - Stores business contact info, timezone, notification phone, and the missed-call SMS text template.

---

## 3. Lead Deduplication & Idempotency Rules

### A. Public Website Inquiries
- **Every valid website submission creates a new `Lead` record**, even if the same phone number submitted another form recently.
- A repeated website submission may represent a separate, urgent job inquiry (e.g. customer submitting for a second vehicle or asking a new question). It is **never** silently overwritten or merged into an earlier inquiry.

### B. Missed-Call Recovery
- When an inbound call is missed, the system checks for an existing **open lead** (`NEW` or `CONTACTED`) for that normalized E.164 phone number created within the last 24 hours.
- If found: it updates the existing open lead by appending a missed-call note and updating `updatedAt`, avoiding inbox clutter from repeated calls.
- If no open lead exists within 24 hours: it creates a new `Lead` record with `source = MISSED_CALL`, `status = NEW`.

### C. Twilio Webhook Idempotency
- Twilio sends retries and status callbacks. The system records incoming calls in `CallWebhookEvent` keyed by `callSid` (unique).
- If `callSid` has already been processed or an SMS has already been dispatched, subsequent callbacks are identified as duplicates and return immediately without sending repeated SMS.

---

## 4. Missed-Call Recovery Determination Logic

### Primary Safety Rule:
> **Book Moar must NEVER send "Sorry we missed your call" after the business successfully answered and spoke with the caller.**

### Twilio Voice Architecture:
1. Customer calls the Twilio number.
2. Twilio requests `POST /api/webhooks/twilio/voice`.
3. Book Moar returns TwiML:
   ```xml
   <Response>
     <Dial action="/api/webhooks/twilio/dial-action" timeout="25">
       <Number>+19195550100</Number>
     </Dial>
   </Response>
   ```
4. Twilio dials the business phone. When the dial finishes, Twilio posts the dialed leg's outcome to the `action` URL (`/api/webhooks/twilio/dial-action`), providing the field `DialCallStatus`.
5. Determination Matrix:
   | `DialCallStatus` | Business Outcome | Recovery Action |
   |---|---|---|
   | `completed` | Business answered and connected | **NO SMS** (Not missed) |
   | `no-answer` | Business did not answer in 25s | **Send recovery SMS** & Log lead |
   | `busy` | Business line was busy | **Send recovery SMS** & Log lead |
   | `failed` | Network/dial error | **Send recovery SMS** & Log lead |
   | `canceled` | Caller hung up before answer | **Send recovery SMS** & Log lead |

---

## 5. Security & Authentication Architecture

- **Single Role**: `OWNER`.
- **No Public Signup**: The single owner account is provisioned during deployment/seed.
- **Passwords**: Hashed with `bcrypt` (10 rounds). Plaintext passwords are never stored.
- **Sessions**: Encrypted, signed HMAC-SHA256 JWT tokens stored in an `httpOnly`, `sameSite: lax`, `secure` cookie (`bookmoar_session`).
- **Authorization**: Enforced server-side in API routes and server components using `requireOwner()` and `getCurrentUser()`.
- **Public Endpoints**: Only `POST /api/leads` (intake), `GET /api/services` (active services only), and Twilio webhooks are accessible without authentication.
- **Anti-Abuse**: Public lead intake includes honeypot validation (`website_hp`) and strict Zod payload validation.

---

## 6. Excluded Features (Out of Scope for START V1)

To protect maintainability and product tier boundaries, the following features are intentionally **NOT** included in START V1:
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
