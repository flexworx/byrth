'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

const labelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  vms: 'Virtual Machines',
  services: 'Services',
  databases: 'Databases',
  networks: 'Networks',
  security: 'Security Center',
  'ai-agents': 'AI Agents',
  monitoring: 'Monitoring',
  compliance: 'Compliance',
  users: 'Users',
  terminal: 'SSH Terminal',
  settings: 'Settings',
  'audit-logs': 'Audit Logs',
  'api-keys': 'API Keys',
  runbooks: 'Runbooks',
  maintenance: 'Maintenance',
  costs: 'Cost Tracking',
  knowledge: 'Knowledge Base',
  'chief-of-staff': 'Chief of Staff AI',
  'ai-ops': 'AI Operations',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  if (!pathname || pathname === '/dashboard') return null

  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((seg, i) => ({
    label: labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }))

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-nexgen-muted mb-4">
      <Link href="/dashboard" className="hover:text-nexgen-accent transition-colors">
        <Home size={12} />
      </Link>
      {crumbs.slice(1).map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight size={10} className="text-nexgen-border" />
          {crumb.isLast ? (
            <span className="text-nexgen-text font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-nexgen-accent transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
