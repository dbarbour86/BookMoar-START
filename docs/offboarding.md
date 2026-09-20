# Book Moar START — Client Offboarding & Data Separation Guide

## 1. Asset Separation Boundary

When a client departs or transitions off the Book Moar platform, clear boundaries separate client-owned property from proprietary Book Moar intellectual property and reusable template code.

### Client-Owned Property (Delivered to Client)
- **Customer & Lead Records**: All contact names, phone numbers, emails, inquiry histories, and timestamps stored during the client's tenure.
- **Business Profile Content**: Business name, descriptions, physical addresses, operating hours, and custom text-back message copies.
- **Client Brand Assets**: Client-provided logos, images, vehicle or job site photos, copywriting, and marketing collateral.
- **Domain Name**: Custom domains registered or owned by the client.
- **Public Website Pages**: HTML/CSS/JS marketing pages or landing page assets built for the client.

### Book Moar Proprietary Material (Retained by Book Moar)
- **Reusable CRM Application Code**: Next.js App Router codebase, React components, state machine definitions, and API route controllers.
- **Lead Intake Engine**: Server-side validation logic, abuse/honeypot filtering, and notification dispatch pipelines.
- **Missed-Call Recovery Subsystem**: Twilio webhook routing, `DialCallStatus` evaluation algorithms, idempotency handlers, and provider adapters.
- **Platform Infrastructure**: Docker configurations, deployment scripts, database migration files, and CI/CD pipelines.
- **Secrets & Service Accounts**: Book Moar master Twilio accounts, server signing keys, hosting account credentials, and platform API keys.

---

## 2. Technical Offboarding Procedure

Follow this 8-step manual checklist whenever offboarding a START client deployment:

### Step 1: Export Client Data
Extract all business records and historical leads from the client's isolated database into standard CSV or JSON format.
```bash
# Example pg_dump or SQL query export for the client instance:
docker exec -i bookmoar-db psql -U bookmoar -d bookmoar_db -c \
  "COPY (SELECT id, name, phone, email, message, source, status, \"contactedAt\", \"closedAt\", \"createdAt\" FROM \"Lead\" ORDER BY \"createdAt\" DESC) TO STDOUT WITH CSV HEADER" > client_leads_export.csv
```
Deliver this CSV securely to the client owner.

### Step 2: Export / Deliver Website Files
If Book Moar was hosting the client's static marketing website or landing page:
1. Export the client's public assets (`images/`, `public/`, HTML landing pages).
2. Prepare a standalone ZIP archive containing only the public marketing assets.

### Step 3: Remove / Replace Book Moar Endpoints
Before delivering public website files:
1. Search all forms for references to `POST https://<client>.bookmoar.com/api/leads`.
2. Replace the action URL with the client's new intake provider (e.g. Formspree, Mailchimp, or the client's new webmaster endpoint) or leave a documented placeholder.
3. Remove any Book Moar-specific analytics or tracking scripts.

### Step 4: Remove Deployment Secrets
Verify the exported archive contains:
- **NO** `.env` or `.env.local` files.
- **NO** database connection strings (`DATABASE_URL`).
- **NO** `AUTH_SECRET` session signing keys.
- **NO** Twilio API credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`).

### Step 5: Revoke & Rotate Credentials
1. Invalidate all existing owner session tokens by rotating the instance `AUTH_SECRET`.
2. Change or delete the database user credentials for the client's database.
3. Remove the client's deployment from the hosting provider (e.g., Vercel / Railway / AWS).

### Step 6: Disconnect Twilio & Integrations
1. Release or reassign the Twilio virtual phone number:
   - If the client is taking the phone number: Initiate a Twilio subaccount transfer or Port-Out request to their carrier.
   - If Book Moar retains the number: Clear the voice webhook URL (`/api/webhooks/twilio/voice`) and SMS webhook URLs in the Twilio Console.
2. Ensure no further automatic recovery text messages can be triggered.

### Step 7: Verify Exported ZIP Hygiene
Execute a security scan on the export package:
```bash
grep -rn "postgresql://" client_export/
grep -rn "TWILIO" client_export/
grep -rn "AUTH_SECRET" client_export/
```
Verify zero occurrences of internal secrets.

### Step 8: Multi-Party Isolation Verification
Because Book Moar START uses a strict **single-business-per-deployment** architecture, the database backup or export file contains exclusively this client's records. Verify that no records from other businesses exist in the export.
