import Link from 'next/link'
import { Shield, Lock, Server } from 'lucide-react'

// Footer with role="contentinfo" for accessibility

const footerLinks = {
  Platform: [
    { label: 'CentralIntel.ai', href: '/platform' },
    { label: 'Network Intelligence', href: '/platform#intelligence' },
    { label: 'Security Operations', href: '/platform#security' },
    { label: 'Infrastructure Automation', href: '/platform#automation' },
  ],
  Services: [
    { label: 'Managed Networks', href: '/services#managed-networks' },
    { label: 'AI-Driven Monitoring', href: '/services#monitoring' },
    { label: 'Compliance & Audit', href: '/services#compliance' },
    { label: 'Incident Response', href: '/services#incident-response' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Industries', href: '/industries' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Status', href: '/status' },
    { label: 'Security', href: '/security' },
  ],
}

const compliance = [
  { icon: Shield, label: 'SOC 2 Type II' },
  { icon: Lock, label: 'NIST SP 800-53' },
  { icon: Server, label: 'Zero Trust' },
]

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="border-t border-nexgen-border/30 bg-nexgen-bg">
      <div className="section-container py-16">
        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-nexgen-text uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-nexgen-muted hover:text-nexgen-accent transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Compliance Badges */}
        <div className="flex flex-wrap items-center gap-4 mb-8 pt-8 border-t border-nexgen-border/20">
          {compliance.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexgen-border/30 bg-nexgen-card/30"
            >
              <Icon size={12} className="text-nexgen-accent" />
              <span className="text-[10px] font-mono text-nexgen-muted">{label}</span>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-nexgen-border/20">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-nexgen-accent to-nexgen-blue flex items-center justify-center">
              <span className="text-white font-bold text-xs font-mono">R</span>
            </div>
            <span className="text-xs text-nexgen-muted">
              &copy; {new Date().getFullYear()} Roosk. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-nexgen-muted hover:text-nexgen-text transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-nexgen-muted hover:text-nexgen-text transition-colors">
              Terms
            </Link>
            <Link href="/security" className="text-xs text-nexgen-muted hover:text-nexgen-text transition-colors">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
