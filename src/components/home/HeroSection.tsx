'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight, Shield, Cpu, Network, Zap } from 'lucide-react'

const stats = [
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '<200ms', label: 'Response Time' },
  { value: '24/7', label: 'AI Monitoring' },
  { value: 'SOC 2', label: 'Certified' },
]

const floatingIcons = [
  { Icon: Shield, x: '10%', y: '20%', delay: 0 },
  { Icon: Cpu, x: '85%', y: '15%', delay: 0.5 },
  { Icon: Network, x: '75%', y: '70%', delay: 1 },
  { Icon: Zap, x: '15%', y: '75%', delay: 1.5 },
]

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-glow" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid-60 opacity-40" />

      {/* Floating Icons */}
      {floatingIcons.map(({ Icon, x, y, delay }, i) => (
        <motion.div
          key={i}
          className="absolute hidden lg:block"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ delay: delay + 0.8, duration: 0.6 }}
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon size={40} className="text-nexgen-accent" />
          </motion.div>
        </motion.div>
      ))}

      <div className="section-container relative z-10">
        <div className="max-w-4xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-nexgen-accent/30 bg-nexgen-accent/5 text-xs font-mono text-nexgen-accent mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-nexgen-accent animate-pulse" />
              Powered by CentralIntel.ai
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            className="heading-xl mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Autonomous Network
            <br />
            <span className="gradient-text">Intelligence Platform</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="body-lg max-w-2xl mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Roosk replaces reactive managed services with AI-driven infrastructure
            intelligence. Predictive analytics, automated incident response, and
            enterprise-grade security — operating autonomously on your behalf.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-wrap gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Link href="/contact" className="btn-primary">
              Request a Demo
              <ChevronRight size={16} />
            </Link>
            <Link href="/platform" className="btn-secondary">
              Explore the Platform
            </Link>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <div className="text-2xl font-bold font-mono text-nexgen-accent">
                  {stat.value}
                </div>
                <div className="text-xs text-nexgen-muted uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-nexgen-bg to-transparent" />
    </section>
  )
}
