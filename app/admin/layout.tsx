import type { Metadata } from 'next'
import { getTenantRowFromRequest, getTenantSettings } from '../../lib/tenantDb'

export async function generateMetadata(): Promise<Metadata> {
  const tenantRow = await getTenantRowFromRequest().catch(() => null)
  const settings = tenantRow ? await getTenantSettings(tenantRow.id).catch(() => ({} as Record<string, string>)) : {}
  const businessName =
    String(settings.BusinessName || '').trim() ||
    tenantRow?.business_name?.trim() ||
    'Admin Dashboard'
  return {
    title: `${businessName} — Admin`,
    applicationName: businessName,
    openGraph: {
      title: `${businessName} — Admin`,
    },
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
