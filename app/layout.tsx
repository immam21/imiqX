import './globals.css'
import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import Header from '../components/ui/Header'
import config from '../config'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap'
})

export const metadata: Metadata = {
  title: config.businessName,
  description: 'Mobile-first e-commerce powered by Google Sheets',
  openGraph: {
    title: config.businessName,
    description: 'Mobile-first e-commerce powered by Google Sheets'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.className}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={config.theme.accent} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 safe-area font-sans">
        <Header />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  )
}
