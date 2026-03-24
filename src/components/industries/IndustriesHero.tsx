'use client'

import { motion } from 'framer-motion'

export function IndustriesHero() {
  return (
    <section className="relative section-padding overflow-hidden">
      <div className="absolute inset-0 bg-hero-glow" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid-60 opacity-30" />

      <div className="section-container relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-mono text-nexgen-accent uppercase tracking-[0.2em] mb-4 block">
            Industries
          </span>
          <h1 className="heading-xl mb-6">
            Built for verticals that
            <br />
            <span className="gradient-text">demand more.</span>
          </h1>
          <p className="body-lg max-w-xl mx-auto">
            Compliance, uptime, and security requirements vary by industry.
            Roosk adapts its AI intelligence to meet the specific demands
            of your sector.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
