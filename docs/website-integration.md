## BOOK MOAR INTEGRATION

This website will be connected to the client's existing **Book Moar START** lead-management system.

The public website and Book Moar are separate applications.

Example architecture:

* Public website: `https://CLIENTDOMAIN.com`
* Private Book Moar application: `https://app.CLIENTDOMAIN.com`

Do NOT copy Book Moar into this website.

Do NOT recreate Book Moar's CRM, dashboard, lead database, appointment system, authentication, or business logic inside the public website.

The website is responsible for the customer-facing experience.

Book Moar is responsible for lead storage and business operations.

---

## ENVIRONMENT CONFIGURATION

Create a server-side environment variable:

`BOOK_MOAR_API_URL`

Example:

`https://app.CLIENTDOMAIN.com`

Do not hard-code the production Book Moar URL throughout the codebase.

Use the environment variable so the website can easily be connected to the correct client deployment.

---

## LEAD / QUOTE FORMS

All website lead and quote forms must submit to the client's Book Moar lead intake system.

Book Moar accepts:

`POST /api/leads`

Expected lead fields:

* `name`
* `phone`
* `email` optional
* `serviceId` optional
* `message` optional
* honeypot field when required by the existing API contract

The website must NOT write directly to the Book Moar database.

The website must NOT contain database credentials.

The website must NOT contain Twilio credentials.

Submit through the supported Book Moar HTTP API only.

---

## SERVER-SIDE PROXY

Prefer submitting public website forms through a local server-side route in this website.

Example:

Customer browser:

`POST /api/contact`

Website server:

`POST ${BOOK_MOAR_API_URL}/api/leads`

This keeps the integration centralized and prevents Book Moar implementation details from being scattered throughout client-side components.

The website server route should:

1. validate the submitted fields
2. forward the appropriate fields to Book Moar
3. handle Book Moar errors safely
4. return a simple success/error response to the browser

Do not expose secrets to browser JavaScript.

---

## SERVICES

The website's quote/contact forms should use the active service catalog from Book Moar where appropriate.

Book Moar remains the source of truth for selectable business services.

Retrieve active services through the existing Book Moar public services API.

Use those services to populate selections such as:

* Full Detail
* Interior Detail
* Exterior Detail
* Ceramic Coating

Do NOT automatically create or remove website SEO/service pages based on this API.

There is an important distinction:

### Book Moar Service Catalog

Controls operational service choices used by:

* lead forms
* quote forms
* lead categorization
* appointments
* default job values

### Website Content

Controls:

* service pages
* SEO copy
* photos
* FAQs
* landing pages
* navigation
* marketing content

Website content remains manually managed.

Adding a service to Book Moar should NOT automatically generate an SEO page.

---

## FORM EXPERIENCE

When a customer submits a lead:

1. Validate required information.
2. Send the lead to Book Moar.
3. Wait for a successful response.
4. Show a clear customer-facing success state.

Example:

"Thanks! We received your request and will be in touch shortly."

Do not claim the lead was received if Book Moar rejected the request.

Prevent accidental duplicate submissions caused by double-clicking the submit button.

Do NOT intentionally deduplicate legitimate separate inquiries from the same customer.

---

## APPOINTMENTS

Book Moar START does NOT provide public customer self-booking.

Do NOT expose Book Moar's internal appointment APIs to customers.

Do NOT build:

* public calendar selection
* availability lookup
* customer self-booking
* rescheduling
* appointment cancellation

Those capabilities belong to a later Book Moar tier.

For START, the website captures the lead.

The business owner then contacts the customer and manually creates the appointment inside Book Moar.

Flow:

Website visitor
→ submits lead
→ Book Moar creates NEW lead
→ business owner receives/sees lead
→ owner contacts customer
→ owner books appointment
→ appointment appears in Book Moar
→ Booked Value updates

---

## SECURITY

The public website must never expose:

* Book Moar database credentials
* authentication secrets
* Twilio credentials
* internal admin credentials
* private Book Moar APIs
* server environment variables

Only explicitly public integration endpoints may be called by the public website.

Preserve all Book Moar validation and abuse protection.

---

## DEVELOPMENT

During local development, allow:

`BOOK_MOAR_API_URL=http://localhost:3000`

or the appropriate local Book Moar port.

In production:

`BOOK_MOAR_API_URL=https://app.CLIENTDOMAIN.com`

Do not make production deployment dependent on localhost.

---

## IMPORTANT

Book Moar is an external operational system used by this website.

Do NOT rebuild Book Moar.

Do NOT add CRM functionality to this website.

Do NOT add appointment-management functionality to this website.

Do NOT expand the Book Moar START feature set.

Build the public website normally and integrate its lead-generation forms with the existing Book Moar API.
