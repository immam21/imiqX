# Business and Working Document

## 1. Executive Summary

imiqX is a WhatsApp-first, mobile ecommerce platform built on Next.js and Google Sheets, with optional Razorpay online payments and multi-tenant architecture.

This platform allows one codebase to serve multiple tenant stores, each with independent branding, catalog, orders, coupons, banners, reviews, and settings.

Primary multi-tenant URL pattern supported:
- `https://mydomain.in/{tenantId}/{tenantBusinessSlug}`
- Example: `https://mydomain.in/tenantid/tenantbusinessname`

Also supported:
- Subdomain tenancy (example: `tenantid.mydomain.in`)

---

## 2. Business Model

### 2.1 Product Positioning

- Category: Ecommerce storefront SaaS for WhatsApp-driven businesses.
- Ideal customer: Local and regional D2C sellers, social sellers, and small retail chains.
- Core value: Fast launch, low tech complexity, and direct order conversation via WhatsApp.

### 2.2 Revenue Options

1. Setup Fee + Monthly Subscription
- One-time onboarding and branding fee.
- Monthly fee per tenant for hosting, maintenance, and support.

2. Subscription Tiers
- Starter: Single store, basic support.
- Growth: Priority support, advanced analytics, custom domain help.
- Pro: Higher traffic limits, premium features, dedicated support.

3. Transaction Fee Add-on (Optional)
- Small platform fee on successful online payments if enabled.

4. Services Revenue
- Catalog onboarding service.
- Marketing landing page optimization.
- SEO and growth support.

### 2.3 Suggested Pricing Framework

- Starter: fixed monthly fee with soft order cap.
- Growth: 2x to 3x Starter pricing with analytics and priority response SLA.
- Pro: custom pricing by volume, integrations, and support commitments.

---

## 3. Target KPIs (Business)

Track these at platform and tenant levels:

1. Tenant acquisition
- New tenants per month.
- Activation rate (tenant with first product + first order).

2. Revenue and retention
- Monthly recurring revenue.
- Churn rate.
- Net revenue retention.

3. Commerce performance
- Conversion rate.
- Average order value.
- Repeat purchase rate.
- Paid vs WhatsApp checkout mix.

4. Operations quality
- Average issue resolution time.
- Order processing turnaround.
- Uptime and incident count.

---

## 4. Platform Scope and Current Feature Set

### 4.1 Storefront
- Home page with banner carousel and featured products.
- Product search and product detail pages.
- Product image gallery and lightbox.
- Cart and checkout flows.

### 4.2 Order Capture
- WhatsApp checkout flow with prefilled message.
- Razorpay payment flow (order create and verify APIs).
- Order persistence in Google Sheets.

### 4.3 Admin
- Password-protected admin panel.
- Order status management, CSV export, print support, edit support.
- Metrics dashboard.
- Product, banner, coupon, and settings management.

### 4.4 Marketing and Trust
- Leads capture popup.
- Reviews.
- Coupons.
- Announcement ticker.

### 4.5 Multi-Tenancy
- Tenant resolution by path and subdomain.
- Tenant config injection in middleware.
- Tenant-specific sheet, branding, and business details.

---

## 5. Technical Working Model

### 5.1 High-Level Architecture

1. Frontend and API
- Next.js App Router application (server and client components).
- API routes under `app/api/*`.

2. Data Layer
- Google Sheets as operational database.
- Shared service account credentials.
- Per-tenant sheet ID mapping.

3. Tenant Resolution
- Middleware maps request to tenant.
- Tenant info is provided through request headers (`x-tenant-*`).
- `lib/tenant.ts` reads tenant context for server components and route handlers.

### 5.2 Request and Data Flow

1. Tenant enters from URL pattern:
- `/tenantId/tenantBusinessSlug/...`

2. Middleware:
- Resolves tenant by path first, then subdomain, then cookie fallback.
- Rewrites internal route path.
- Sets tenant context headers.
- Persists tenant context cookie.

3. Server logic:
- Reads tenant context from `getTenantConfig()`.
- Uses tenant `gsheetId` for product/order/settings/review/coupon operations.

4. Client checkout:
- Creates order in tenant sheet.
- User completes WhatsApp or Razorpay flow.

---

## 6. Operational Runbook

### 6.1 Tenant Onboarding SOP

1. Create Google Sheet for tenant with required tabs.
2. Share sheet with service account email (Editor).
3. Add tenant in `tenants.json`:
- `businessName`
- `whatsappNumber`
- `gsheetId`
- `currency`
- `logoUrl`
- `deliveryCharge`
4. Configure domain route:
- Path mode: `/tenantId/tenantBusinessSlug`
- Optional subdomain mode: `tenantId.mydomain.in`
5. Validate:
- Home, search, product page, cart, checkout.
- Coupon and review operations.
- Track order.
6. Admin setup:
- Share admin URL and password.
- Confirm order status update and export works.

### 6.2 Daily Operations SOP

1. Monitor pending orders and fulfillment queue.
2. Validate payment reconciliation for Razorpay orders.
3. Review error logs and broken API responses.
4. Check tenant sheets for malformed rows or missing columns.
5. Backup critical business sheets periodically.

### 6.3 Incident Response SOP

1. Classify incident:
- P0: checkout/order broken for all tenants.
- P1: major tenant unavailable.
- P2: partial feature failure.

2. Immediate actions:
- Capture failing URL and tenant.
- Check environment variables.
- Verify sheet access and column integrity.
- Roll back last risky changes if needed.

3. Communication:
- Notify impacted tenant(s) with ETA.
- Confirm resolution and post-incident summary.

---

## 7. Security and Compliance Basics

1. Secrets management
- Keep service account key and payment secrets only in environment variables.
- Never expose server credentials to client bundles.

2. Access control
- Protect admin routes with strong password policies.
- Rotate admin password periodically.

3. Data handling
- Store only necessary customer PII.
- Limit staff access to sheets and admin panel.

4. Audit and backups
- Maintain backup cadence for sheets.
- Keep deployment and incident logs.

---

## 8. Standard Environment Variables

Mandatory:
- `SHEET_CLIENT_EMAIL`
- `SHEET_PRIVATE_KEY`
- `ADMIN_PASSWORD`

Default/fallback business values:
- `GSHEET_ID`
- `BUSINESS_NAME`
- `WHATSAPP_NUMBER`
- `DELIVERY_CHARGE`
- `LOGO_URL`

Payments:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

---

## 9. Required Google Sheets Tabs

Minimum recommended tabs per tenant:
- `Products`
- `Orders`
- `Settings`
- `Leads`
- `Testimonials`
- `Reviews`
- `Banners`
- `Coupons`
- `Categories`

Use consistent column names to avoid data parsing issues.

---

## 10. Team Roles and Responsibilities

1. Business Owner
- Pricing, package strategy, tenant approvals.

2. Tenant Success / Operations
- Onboarding, catalog quality checks, SLA follow-up.

3. Technical Owner
- Deployments, incident handling, code updates, monitoring.

4. Support Team
- First-level triage, admin usage help, ticket logging.

---

## 11. 90-Day Execution Plan

Days 1 to 30
- Stabilize onboarding checklist and tenant templates.
- Set up reporting dashboard for platform KPIs.
- Define support SLA and escalation matrix.

Days 31 to 60
- Add tenant self-service onboarding flow.
- Improve analytics and conversion tracking.
- Add stronger admin authentication model.

Days 61 to 90
- Launch billing automation.
- Add plan-based feature gating.
- Prepare migration path from Sheets to dedicated DB for scale.

---

## 12. Working Checklist Before Go-Live

1. Tenant URL route works (`/{tenantId}/{slug}`).
2. Tenant branding and settings load correctly.
3. Product listing and detail pages load correctly.
4. Cart and checkout calculations are correct.
5. WhatsApp order link opens correctly with order text.
6. Razorpay flow (if enabled) creates and verifies payments.
7. Admin login and order management works.
8. Track order endpoint returns expected status.
9. PWA install and offline page are functioning.
10. Build and deploy pipeline passes cleanly.

---

## 13. Source of Truth in This Repository

Primary configuration and tenant files:
- `tenants.json`
- `middleware.ts`
- `lib/tenant.ts`
- `services/productService.ts`
- `services/orderService.ts`
- `app/api/*`
- `app/admin/page.tsx`

---

## 14. Notes for Future Scale

For low to medium tenant volume, Google Sheets is a practical start. For high concurrency, large catalogs, and complex analytics, move to a database-backed multi-tenant architecture (for example PostgreSQL + row-level tenant isolation).

Keep the current middleware + tenant-context pattern, and swap the data layer behind service functions to minimize frontend changes.
