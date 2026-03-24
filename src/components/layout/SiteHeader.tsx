'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

const navLinks = [
  { href: '/platform', label: 'Platform' },
  { href: '/services', label: 'Services' },
  { href: '/industries', label: 'Industries' },
  { href: '/about', label: 'About' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50" role="banner">
      <div className="bg-nexgen-bg/80 backdrop-blur-xl border-b border-nexgen-border/30">
        <div className="section-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-nexgen-accent to-nexgen-blue flex items-center justify-center glow-accent group-hover:animate-glow-pulse transition-all">
                <span className="text-white font-bold text-base font-mono">R</span>
              </div>
              <div>
                <span className="text-sm font-bold text-nexgen-text tracking-wide">ROOSK</span>
                <span className="hidden sm:block text-[9px] text-nexgen-muted tracking-[0.25em] uppercase">
                  Network Intelligence
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'px-4 py-2 text-sm rounded-lg transition-all duration-200',
                    pathname === link.href
                      ? 'text-nexgen-accent bg-nexgen-accent/10'
                      : 'text-nexgen-muted hover:text-nexgen-text hover:bg-nexgen-card/50',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex btn-secondary text-xs py-2 px-4"
              >
                Operations Center
              </Link>
              <Link
                href="/contact"
                className="hidden md:inline-flex btn-primary text-xs py-2 px-4"
              >
                Request Demo
                <ChevronRight size={14} />
              </Link>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="md:hidden p-2 rounded-lg hover:bg-nexgen-card transition-colors"
              >
                {mobileOpen ? (
                  <X size={20} className="text-nexgen-text" />
                ) : (
                  <Menu size={20} className="text-nexgen-text" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-nexgen-surface/95 backdrop-blur-xl border-b border-nexgen-border/30 overflow-hidden"
          >
            <nav aria-label="Mobile navigation" className="section-container py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'block px-4 py-3 rounded-lg text-sm transition-colors',
                    pathname === link.href
                      ? 'text-nexgen-accent bg-nexgen-accent/10'
                      : 'text-nexgen-muted hover:text-nexgen-text hover:bg-nexgen-card/50',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Link href="/dashboard" className="btn-secondary text-center text-xs py-2.5" onClick={() => setMobileOpen(false)}>
                  Operations Center
                </Link>
                <Link href="/contact" className="btn-primary text-center text-xs py-2.5" onClick={() => setMobileOpen(false)}>
                  Request Demo
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
