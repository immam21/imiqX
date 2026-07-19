import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AppShell from '../components/AppShell'
import PWAProvider from '../components/PWAProvider'
import config from '../config'
import { fetchSettings } from '../services/productService'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,   // avoid network call during build; font is loaded by the browser at runtime
})

export const metadata: Metadata = {
  title: config.businessName,
  description: 'Premium products with live inventory and seamless WhatsApp checkout.',
  applicationName: config.businessName,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: config.businessName,
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: config.businessName,
    description: 'Premium products with live inventory and seamless WhatsApp checkout.',
  },
}

export const revalidate = 300 // cache layout data for 5 minutes

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchSettings().catch(() => ({
    offerLabel: '', offerTitle: '', offerSubtitle: '', announcementMessages: [] as string[],
  }))

  // Compute server-side so the value is consistent during hydration.
  // process.env.BUSINESS_NAME is not exposed to the client bundle, causing
  // a hydration mismatch if derived inside a Client Component.
  const initials = config.businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={config.theme.accent} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content={config.theme.accent} />

        {/* Apple PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={config.businessName} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
      </head>
      <body className={`min-h-screen bg-[#F8FAFC] text-slate-900 safe-area ${inter.className}`}>
        <AppShell
          initials={initials}
          businessName={config.businessName}
          logo={config.logo}
          whatsappNumber={config.whatsappNumber}
          announcementMessages={settings.announcementMessages}
        >
          <main className="pt-[92px]">{children}</main>
          <PWAProvider />
        </AppShell>
      </body>
    </html>
  )
}
