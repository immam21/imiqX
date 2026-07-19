const config = {
  businessName: process.env.BUSINESS_NAME ?? 'My Shop',
  logo: process.env.LOGO_URL ?? '',
  whatsappNumber: process.env.WHATSAPP_NUMBER ?? '',
  deliveryCharge: Number(process.env.DELIVERY_CHARGE ?? 40),
  currency: process.env.CURRENCY ?? 'INR',
  gsheetId: process.env.GSHEET_ID ?? '',
  theme: {
    primary: '#111827',
    accent: '#1f6feb'
  }
}

export default config
