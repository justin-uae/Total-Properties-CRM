# Total Business Centres CRM

A modern CRM system rebuilt in the requested stack:

- **Language:** JavaScript / TypeScript
- **Framework:** React + Next.js App Router
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM with SQLite by default for local testing; can be changed to MySQL/PostgreSQL for production

## Main Features Included

### Sales
- Leads
- Web Form Leads
- Telephone and WhatsApp lead sources
- Quotations with public quote links
- Viewings
- Call logs
- Lost lead reasons and competitor tracking

### Spaces
- Virtual Office
- Co Working Office
- Private Office
- Two address locations for all service types
- Private office image/document upload support
- Meeting rooms
- Meeting room bookings with clash detection
- Occupancy calendar placeholder
- Floor plan placeholder

### Clients / Tenants
- Clients / Tenants
- Contracts
- Contract expiry and renewal reminders
- Secure private documents
- Deposits
- Move-outs
- Tenant portal starter

### Finance
- Invoices
- Public invoice links
- Invoice viewed tracking
- Email invoice route
- Stripe Checkout integration, off by default
- Stripe webhook payment verification route
- Payments
- Recurring billing
- Add-on services
- Payment alerts
- Accounting exports

### Operations
- Reception Daily Dashboard
- Visitor check-in/check-out
- Mail / parcel management
- Access cards and keys
- Maintenance tickets

### Admin
- Master Admin
- Staff users
- Granular permissions
- Audit log model
- Automation rules
- Automation queue and cron route
- WhatsApp Cloud API webhook route with signature verification support
- Theme selector with six colour themes
- Settings

## Setup Instructions

### 1. Install packages

```bash
npm install
```

### 2. Create environment file

```bash
cp .env.example .env
```

For local testing, keep:

```env
DATABASE_URL="file:./dev.db"
```

For production, use PostgreSQL or MySQL and update the Prisma datasource provider in `prisma/schema.prisma`.

### 3. Create database

```bash
npx prisma migrate dev --name init
```

### 4. Seed demo data

```bash
npm run db:seed
```

### 5. Start development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Default Login

```text
Email: admin@example.com
Password: Admin123!
```

Change this password immediately before live use.

## Website Form Endpoint

Your website can POST JSON to:

```text
https://yourdomain.com/api/public/web-form-leads
```

Example body:

```json
{
  "fullName": "Customer Name",
  "email": "customer@example.com",
  "telephone": "+971501234567",
  "enquiry": "I need a private office",
  "serviceType": "Private Office",
  "location": "Address Location 1",
  "source": "Website"
}
```

Includes basic rate limiting, duplicate check and honeypot support.

## Public Meeting Room Booking Endpoint

```text
https://yourdomain.com/public/meeting-room-booking
```

API endpoint:

```text
https://yourdomain.com/api/public/meeting-room-booking
```

The API checks for overlapping bookings before accepting the request.

## Stripe Setup

Stripe is off by default.

1. Add Stripe keys in Settings or environment.
2. Set your webhook endpoint in Stripe:

```text
https://yourdomain.com/api/stripe/webhook
```

3. Add webhook secret to `.env`:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

The webhook verifies Stripe signatures before marking an invoice as paid.

## WhatsApp Cloud API Setup

Webhook URL:

```text
https://yourdomain.com/api/whatsapp/webhook
```

Environment values:

```env
WHATSAPP_VERIFY_TOKEN="your-verify-token"
WHATSAPP_APP_SECRET="your-meta-app-secret"
```

Incoming WhatsApp messages create CRM leads and queue automation.

## Private Files

Customer documents are stored in:

```text
storage/private/
```

Files are not served publicly from `/public`. They should be downloaded via the protected API route:

```text
/api/files/[id]
```

## Cron / Automation

Run due automation jobs using:

```text
https://yourdomain.com/api/cron/automation?key=YOUR_CRON_SECRET
```

Recommended schedule: every 5 minutes.

Add to `.env`:

```env
CRON_SECRET="change-this-secret"
```

## Production Recommendations

Before going live with real customer data:

1. Use PostgreSQL or MySQL instead of SQLite.
2. Use HTTPS only.
3. Change default admin password.
4. Configure SMTP properly.
5. Configure Stripe webhook signing.
6. Configure WhatsApp webhook signing.
7. Restrict staff permissions carefully.
8. Set up automated backups.
9. Put `storage/private` outside publicly accessible hosting directories.
10. Test all workflows with dummy data before uploading real documents.

## Notes

This is a complete modern Next.js foundation for Total Business Centres CRM. Some advanced areas such as calendar/floor-plan visualisation, tenant portal self-service and accounting integrations are implemented as structured modules/placeholders ready for expansion into richer screens.
