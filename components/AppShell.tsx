'use client'

/**
 * AppShell — client-only boundary that owns:
 *   • CartProvider  (global cart context)
 *   • Header        (uses useCart for live count)
 *   • WhatsApp FAB
 *
 * layout.tsx (Server Component) renders this component and passes only
 * serialisable props + children, which is the correct Next.js App Router
 * pattern for sharing context across the whole layout without module-graph
 * ambiguity.
 */

import React from 'react'
import { CartProvider } from '../hooks/useCart'
import Footer from './ui/Footer'
import Header from './ui/Header'

interface AppShellProps {
  initials: string
  businessName: string
  businessAddress?: string
  logo: string
  whatsappNumber: string
  themePreset?: string
  instagramUrl?: string
  facebookUrl?: string
  youtubeUrl?: string
  routePrefix?: string
  announcementMessages?: string[]
  children: React.ReactNode
}

function getThemeVars(themePreset?: string) {
  const theme = String(themePreset || 'classic').trim().toLowerCase()

  const themes: Record<string, React.CSSProperties> = {
    classic: {
      ['--bg' as any]: '#F8FAFC',
      ['--surface' as any]: '#FFFFFF',
      ['--text' as any]: '#0F172A',
      ['--muted' as any]: '#64748B',
      ['--accent' as any]: '#2563EB',
      ['--accent-light' as any]: '#3B82F6',
      ['--accent-soft' as any]: '#EFF6FF',
    },
    ocean: {
      ['--bg' as any]: '#F5FBFF',
      ['--surface' as any]: '#FFFFFF',
      ['--text' as any]: '#082F49',
      ['--muted' as any]: '#64748B',
      ['--accent' as any]: '#0EA5E9',
      ['--accent-light' as any]: '#38BDF8',
      ['--accent-soft' as any]: '#E0F2FE',
    },
    forest: {
      ['--bg' as any]: '#F4FBF6',
      ['--surface' as any]: '#FFFFFF',
      ['--text' as any]: '#052E16',
      ['--muted' as any]: '#64748B',
      ['--accent' as any]: '#16A34A',
      ['--accent-light' as any]: '#22C55E',
      ['--accent-soft' as any]: '#DCFCE7',
    },
    sunset: {
      ['--bg' as any]: '#FFF8F5',
      ['--surface' as any]: '#FFFFFF',
      ['--text' as any]: '#431407',
      ['--muted' as any]: '#7C2D12',
      ['--accent' as any]: '#F97316',
      ['--accent-light' as any]: '#FB923C',
      ['--accent-soft' as any]: '#FFEDD5',
    },
    midnight: {
      ['--bg' as any]: '#0B1020',
      ['--surface' as any]: '#111827',
      ['--text' as any]: '#E5E7EB',
      ['--muted' as any]: '#94A3B8',
      ['--accent' as any]: '#8B5CF6',
      ['--accent-light' as any]: '#A78BFA',
      ['--accent-soft' as any]: '#1F2937',
    },
  }

  return themes[theme] || themes.classic
}

export default function AppShell({
  initials,
  businessName,
  businessAddress,
  logo,
  whatsappNumber,
  themePreset,
  instagramUrl,
  facebookUrl,
  youtubeUrl,
  routePrefix = '',
  announcementMessages = [],
  children,
}: AppShellProps) {
  const themeVars = getThemeVars(themePreset)

  return (
    <div data-storefront-theme={String(themePreset || 'classic').trim().toLowerCase()} style={themeVars}>
      <CartProvider>
        <Header
          initials={initials}
          businessName={businessName}
          logo={logo}
          routePrefix={routePrefix}
          announcementMessages={announcementMessages}
        />
        {children}
        <Footer
          businessName={businessName}
          businessAddress={businessAddress}
          initials={initials}
          logo={logo}
          whatsappNumber={whatsappNumber}
          instagramUrl={instagramUrl}
          facebookUrl={facebookUrl}
          youtubeUrl={youtubeUrl}
          routePrefix={routePrefix}
        />
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-[#25D366]/40 transition-all hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/40 sm:right-6"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="white" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        )}
      </CartProvider>
    </div>
  )
}
