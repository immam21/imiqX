
# imiqX — WhatsApp-Native Ecommerce Platform

A production-ready, mobile-first ecommerce storefront built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Google Sheets** as the database. Orders are confirmed via WhatsApp or Razorpay online payment. Multi-tenant subdomain support included.

Business and operations reference:
- See `BUSINESS_WORKING_DOCUMENT.md` for business model, onboarding SOP, multi-tenant working flow, runbook, and go-live checklist.

---

## Features

| Category | What's included |
|----------|----------------|
| **Storefront** | Home page with hero + animated banner carousel, product grid/list, product detail with image lightbox, search & category filter |
| **Cart & Checkout** | Persistent cart (localStorage), coupon codes, dynamic delivery charge, WhatsApp checkout + Razorpay UPI/card payment |
| **Orders** | Saved to Google Sheets, track-order page, WhatsApp confirmation message |
| **Admin Dashboard** | `/admin` — orders (with CSV export, print, edit, status update), analytics, products, banners, coupons, settings |
| **Lead Capture** | Popup with name + WhatsApp, saved to Leads sheet |
| **Reviews** | Per-product star ratings and review submission |
| **Banners** | Image carousel configurable from Sheets |
| **PWA** | Service worker, install prompt, offline page |
| **Multi-tenant** | Subdomain-based routing — each subdomain reads its own Google Sheet |

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd imiqX-main
npm install
```

### 2. Google Sheets setup

1. Create a Google Sheet with these tabs: `Products`, `Orders`, `Settings`, `Leads`, `Testimonials`, `Reviews`, `Banners`, `Coupons`, `Categories`
2. Go to [Google Cloud Console](https://console.cloud.google.com) → Create a service account
3. Enable the **Google Sheets API**
4. Generate a JSON key → copy `client_email` and `private_key`
5. Share the spreadsheet with the service account email (Editor access)

### 3. Configure environment variables

Create `.env.local`:

```env
# Google Sheets
SHEET_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
SHEET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GSHEET_ID=your_google_sheet_id

# Business config
BUSINESS_NAME=Your Shop Name
WHATSAPP_NUMBER=91XXXXXXXXXX
DELIVERY_CHARGE=40
LOGO_URL=

# Client-side mirrors
NEXT_PUBLIC_BUSINESS_NAME=Your Shop Name
NEXT_PUBLIC_WHATSAPP_NUMBER=91XXXXXXXXXX
NEXT_PUBLIC_DELIVERY_CHARGE=40
NEXT_PUBLIC_CURRENCY=INR
NEXT_PUBLIC_LOGO_URL=

# Admin
ADMIN_PASSWORD=your_strong_password

# Razorpay (https://dashboard.razorpay.com → Settings → API Keys)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
```

### 4. Run locally

```bash
npm run dev        # development (clears .next first if switching from build)
# OR
npm run build && npm start   # production preview
```

> ⚠️ **Never mix `npm run build` and `npm run dev` without clearing `.next` first.**  
> Run `rm -rf .next` before switching between the two.

---

## Google Sheets Structure

### `Products`
`ProductID | Name | Category | Brand | Description | Price | OfferPrice | Discount | Stock | Rating | Image1 | Image2 | Image3 | Image4 | Featured | Active | CreatedDate`

### `Orders` (auto-populated)
`OrderID | Date | CustomerName | CustomerMobile | DoorNumber | FullAddress | City | Pincode | ProductsJSON | Subtotal | DeliveryCharge | CouponCode | CouponDiscount | GrandTotal | OrderStatus | WhatsAppSent`

### `Settings` (Key → Value pairs)
| Key | Purpose |
|-----|---------|
| `OfferLabel` | Leads popup badge text |
| `OfferTitle` | Leads popup heading |
| `OfferSubtitle` | Leads popup subtitle |
| `AnnouncementBar` | Pipe-separated ticker messages |
| `DeliveryCharge` | Dynamic delivery charge (overrides env var) |
| `LogoURL` | Logo image URL |

### `Reviews`
`ReviewID | ProductID | Name | Rating | Review | Date`

### `Banners`
`BannerID | Title | Subtitle | ImageURL | LinkURL | ButtonText`

### `Coupons`
`Code | Type (percent/flat) | Value | MinOrder | Expiry | Active`

### `Leads` (auto-populated)
`LeadID | Date | Name | WhatsApp | Source | BrowserID`

### `Testimonials`
`Name | Location | Review | Rating | Avatar`

---

## Admin Dashboard

Visit `/admin` and log in with `ADMIN_PASSWORD`.

| Tab | Features |
|-----|---------|
| **Orders** | Live order list, status updates (Pending → Shipped → Delivered), CSV export, print receipt, inline edit |
| **Analytics** | Revenue chart (7-day), orders by status, top products, fulfillment rate, AOV |
| **Products** | View catalog, add new products |
| **Banners** | Add/delete banner carousel slides |
| **Coupons** | Create/delete percent or flat discount codes |
| **Settings** | Update all store settings (saves to Sheets) + env var status panel |

---

## Razorpay Payment

1. Create account at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys → Generate Test Key**
3. Add keys to `.env.local`
4. On checkout, customers can choose **WhatsApp** or **Pay Online (UPI/Card)**
5. Switch to live keys (`rzp_live_`) before going to production

---

## Multi-Tenant / SaaS (Subdomain System)

Each subdomain reads its own Google Sheet — one deployment serves unlimited clients.

### Add a new tenant

1. Open `tenants.json` and add:
```json
{
  "clientname": {
    "businessName": "Client Shop",
    "whatsappNumber": "91XXXXXXXXXX",
    "gsheetId": "THEIR_SHEET_ID",
    "currency": "INR",
    "logoUrl": "",
    "deliveryCharge": 50
  }
}
```
2. Share your Google service account with their sheet (Editor)
3. In Vercel → **Domains** → add `clientname.yourdomain.com`
4. Redeploy

The middleware auto-detects the subdomain and injects the right Sheet ID into every request. No code changes needed per client.

---

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add all `.env.local` variables in **Vercel → Project → Settings → Environment Variables**.

> For `SHEET_PRIVATE_KEY`: paste the full PEM key including `-----BEGIN/END PRIVATE KEY-----` headers. Vercel handles newlines correctly.

---

## Project Structure

```
app/
  page.tsx              # Home (server component)
  layout.tsx            # Root layout with tenant config
  cart/                 # Cart page
  checkout/             # Checkout (WhatsApp + Razorpay)
  product/[id]/         # Product detail
  search/               # Search & filter
  track-order/          # Order tracking
  admin/                # Admin dashboard
  api/
    orders/             # POST create order
    products/           # GET product list
    settings/           # GET store settings
    coupons/            # GET validate coupon
    reviews/            # GET/POST product reviews
    leads/              # POST lead capture
    track-order/        # GET order status
    payment/
      create-order/     # POST Razorpay order
      verify/           # POST payment verification
    admin/              # Admin API routes (auth, orders, stats, settings, banners, coupons, products)

components/
  ui/Header.tsx         # Fixed header with ticker
  ui/Footer.tsx
  product/              # ProductCard, Gallery, Reviews, AddToCart
  home/BannerCarousel.tsx
  cart/StickyCartBar.tsx

services/
  productService.ts     # All data fetching (accepts sheetId)
  orderService.ts       # Order creation + WhatsApp message

lib/
  googleSheets.ts       # Low-level Sheets read/write/update
  tenant.ts             # Multi-tenant config resolver

middleware.ts           # Subdomain → tenant config injection
tenants.json            # Tenant registry
```

---

## Flow Diagrams

**Order via WhatsApp:**
```
Customer fills form → POST /api/orders → Saved to Sheets → wa.me link generated → Customer sends WhatsApp → Owner sees order
```

**Order via Razorpay:**
```
Customer fills form → POST /api/orders (Pending) → POST /api/payment/create-order → Razorpay popup → Customer pays → POST /api/payment/verify → Order marked Paid
```

**Multi-tenant request:**
```
shop1.yourdomain.com → middleware reads subdomain → loads tenants.json["shop1"] → injects x-tenant-* headers → server components call getTenantConfig() → reads from shop1's Sheet
```


Quick start (local):

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill required values (Google service account credentials, `GSHEET_ID`, `WHATSAPP_NUMBER`).

3. Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm run start
```

Notes:
- The Google service account must have Editor access to the spreadsheet. Create sheets named exactly: `Products`, `Categories`, `Orders`, `Leads`.
- Add the spreadsheet ID to `GSHEET_ID` in environment variables.
- For Vercel deployment follow `vercel_deploy.md` and set env vars in the Vercel dashboard.

Files of interest:
- `hooks/useCart.ts` — cart state and persistence
- `services/productService.ts` — product fetching from Google Sheets
- `services/orderService.ts` — server-side order creation
- `lib/googleSheets.ts` — Google Sheets helper
- `app/api/products/route.ts` — products API for client search
- `app/api/orders/route.ts` — server-side order creation and WhatsApp link

Replace placeholder icons (`public/icons`) with real icons for PWA.

