import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Imiqx Platform Admin',
  applicationName: 'Imiqx',
  openGraph: {
    title: 'Imiqx Platform Admin',
  },
}

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
