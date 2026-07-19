// Values used in Client Components must be prefixed with NEXT_PUBLIC_.
// We fall back to the non-prefixed server-only name so the same .env.local
// works for both old (server-only) and new (NEXT_PUBLIC_) usage.
const config = {
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? process.env.BUSINESS_NAME ?? 'My Shop',
  logo: process.env.NEXT_PUBLIC_LOGO_URL ?? process.env.LOGO_URL ?? '',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? process.env.WHATSAPP_NUMBER ?? '',
  deliveryCharge: Number(process.env.NEXT_PUBLIC_DELIVERY_CHARGE ?? process.env.DELIVERY_CHARGE ?? 40),
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? process.env.CURRENCY ?? 'INR',
  gsheetId: process.env.GSHEET_ID ?? '', // server-only — never expose to browser
  theme: {
    primary: '#111827',
    accent: '#2563EB',
  },
}

export default config
