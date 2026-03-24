'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight, ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="section-padding bg-nexgen-bg relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-hero-glow opacity-50" />

      <div className="section-container relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="heading-lg mb-6">
            Ready to replace reactive support
            <br />
            with <span className="gradient-text">autonomous intelligence?</span>
          </h2>
          <p className="body-lg mb-10 max-w-xl mx-auto">
            See how Roosk transforms infrastructure management from ticket-driven
            firefighting into AI-driven operational excellence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact" className="btn-primary text-base px-8 py-4">
              Schedule a Demo
              <ChevronRight size={18} />
            </Link>
            <Link href="/platform" className="btn-secondary text-base px-8 py-4">
              View Platform Architecture
              <ArrowRight size={18} />
            </Link>
          </div>

          <p className="text-xs text-nexgen-muted mt-8 font-mono">
            No sales pressure. No commitment. Just a conversation about your infrastructure.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
