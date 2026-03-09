'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Server, Database, Network, Shield,
  Bot, Activity, FileCheck, Settings, Boxes, Users, Terminal,
  X, FileText, Key, PlayCircle, CalendarClock, DollarSign, BookOpen, Brain,
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/vms', icon: Server, label: 'Virtual Machines' },
  { href: '/dashboard/services', icon: Boxes, label: 'Services' },
  { href: '/dashboard/databases', icon: Database, label: 'Databases' },
  { href: '/dashboard/networks', icon: Network, label: 'Networks' },
  { href: '/dashboard/security', icon: Shield, label: 'Security' },
  { href: '/dashboard/ai-agents', icon: Bot, label: 'AI Agents' },
  { href: '/dashboard/monitoring', icon: Activity, label: 'Monitoring' },
  { href: '/dashboard/compliance', icon: FileCheck, label: 'Compliance' },
  { href: '/dashboard/users', icon: Users, label: 'Users' },
  { href: '/dashboard/audit-logs', icon: FileText, label: 'Audit Logs' },
  { href: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { href: '/dashboard/runbooks', icon: PlayCircle, label: 'Runbooks' },
  { href: '/dashboard/maintenance', icon: CalendarClock, label: 'Maintenance' },
  { href: '/dashboard/costs', icon: DollarSign, label: 'Cost Tracking' },
  { href: '/dashboard/knowledge', icon: BookOpen, label: 'Knowledge Base' },
  { href: '/dashboard/ai-ops', icon: Bot, label: 'AI Operations' },
  { href: '/dashboard/chief-of-staff', icon: Brain, label: 'Chief of Staff AI' },
  { href: '/dashboard/terminal', icon: Terminal, label: 'SSH Terminal' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-nexgen-border/30">
        <Link href="/" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-nexgen-accent to-nexgen-blue flex items-center justify-center glow-accent">
            <span className="text-white font-bold text-lg font-mono">B</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-nexgen-text tracking-wide">BYRTH</h1>
            <p className="text-[10px] text-nexgen-muted tracking-widest uppercase">NexGen Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-nexgen-accent/10 text-nexgen-accent border border-nexgen-accent/20 glow-accent'
                  : 'text-nexgen-muted hover:text-nexgen-text hover:bg-nexgen-card',
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Server info */}
      <div className="p-4 border-t border-nexgen-border/30">
        <div className="glass-card p-3 space-y-1">
          <p className="text-[10px] text-nexgen-muted uppercase tracking-wider">Server</p>
          <p className="text-xs font-mono text-nexgen-text">Dell R7625</p>
          <p className="text-[10px] text-nexgen-muted">2x EPYC 9354 &middot; 128GB &middot; 11.5TB</p>
        </div>
      </div>
    </>
  )
}

export function DashboardSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside aria-label="Dashboard navigation" className="hidden lg:flex w-64 h-screen bg-nexgen-surface border-r border-nexgen-border/50 flex-col fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
              onClick={onMobileClose}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              aria-label="Mobile dashboard navigation"
              role="dialog"
              aria-modal="true"
              className="lg:hidden fixed left-0 top-0 w-[280px] h-screen bg-nexgen-surface border-r border-nexgen-border/50 flex flex-col z-50"
            >
              <button
                onClick={onMobileClose}
                aria-label="Close sidebar"
                className="absolute top-5 right-4 p-1.5 rounded-lg hover:bg-nexgen-card transition-colors"
              >
                <X size={18} className="text-nexgen-muted" />
              </button>
              <SidebarContent onNavigate={onMobileClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
