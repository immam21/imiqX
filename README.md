
# Mobile-first E-commerce (Next.js + Google Sheets)

This project is a mobile-first e-commerce storefront scaffold using Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, and Google Sheets as the backend. It uses WhatsApp for order placement.

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

