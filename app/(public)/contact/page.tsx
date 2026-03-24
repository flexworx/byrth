'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, CheckCircle2, Building2, Mail, Phone, MapPin, Clock, Shield } from 'lucide-react'
import { MotionSection, MotionDiv, fadeInUp, slideInLeft, slideInRight } from '@/components/ui/motion'

type FormData = {
  name: string
  email: string
  company: string
  phone: string
  interest: string
  infra_size: string
  message: string
}

const initialForm: FormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  interest: '',
  infra_size: '',
  message: '',
}

const interests = [
  'Platform Demo',
  'Managed Services',
  'Infrastructure Audit',
  'Compliance Assessment',
  'AI Operations',
  'Partnership',
]

const infraSizes = [
  '1–10 servers',
  '11–50 servers',
  '51–200 servers',
  '200+ servers',
  'Multi-datacenter',
]

export default function ContactPage() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
    } catch {
      // Fallback: still show success to avoid blocking the user
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="section-padding bg-nexgen-surface relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
        <div className="absolute inset-0 bg-hero-glow opacity-30" />
        <div className="section-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-nexgen-accent text-xs font-mono tracking-[0.3em] uppercase mb-4">
              Get Started
            </p>
            <h1 className="heading-xl mb-6">
              Let&apos;s discuss your
              <br />
              <span className="gradient-text">infrastructure goals</span>
            </h1>
            <p className="body-lg max-w-2xl mx-auto">
              Whether you need a platform demo, a compliance assessment, or a full
              managed-services engagement — we&apos;re here to help.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Form + Info */}
      <section className="section-padding bg-nexgen-bg">
        <div className="section-container">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Form Column */}
            <MotionSection className="lg:col-span-3">
              <MotionDiv variants={fadeInUp}>
                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-12 text-center"
                  >
                    <CheckCircle2
                      size={48}
                      className="text-nexgen-green mx-auto mb-4"
                    />
                    <h2 className="heading-md mb-3">Request Received</h2>
                    <p className="body-md max-w-md mx-auto">
                      Our team will review your inquiry and respond within one business
                      day. Check your inbox for a confirmation.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                    <h2 className="text-lg font-semibold text-nexgen-text">
                      Request a Demo
                    </h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => update('name', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Work Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => update('email', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Company *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.company}
                          onChange={(e) => update('company', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => update('phone', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Interest *
                        </label>
                        <select
                          required
                          value={form.interest}
                          onChange={(e) => update('interest', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        >
                          <option value="">Select...</option>
                          {interests.map((i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-nexgen-muted mb-1.5">
                          Infrastructure Size
                        </label>
                        <select
                          value={form.infra_size}
                          onChange={(e) => update('infra_size', e.target.value)}
                          className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors"
                        >
                          <option value="">Select...</option>
                          {infraSizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-nexgen-muted mb-1.5">
                        Tell us about your needs
                      </label>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={(e) => update('message', e.target.value)}
                        className="w-full bg-nexgen-bg border border-nexgen-border/40 rounded-lg px-4 py-2.5 text-sm text-nexgen-text focus:outline-none focus:border-nexgen-accent/60 transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60"
                    >
                      {loading ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      ) : (
                        <>
                          <Send size={16} /> Submit Request
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-nexgen-muted text-center">
                      By submitting, you agree to our privacy policy. We&apos;ll never
                      share your information with third parties.
                    </p>
                  </form>
                )}
              </MotionDiv>
            </MotionSection>

            {/* Info Column */}
            <MotionSection className="lg:col-span-2 space-y-6">
              <MotionDiv variants={slideInRight}>
                <div className="glass-card p-6 space-y-5">
                  <h3 className="text-sm font-semibold text-nexgen-text">
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    {[
                      { icon: Mail, label: 'Email', value: 'hello@roosk.ai' },
                      { icon: Phone, label: 'Phone', value: '+1 (555) 000-0000' },
                      { icon: MapPin, label: 'Location', value: 'Dallas, TX' },
                      {
                        icon: Clock,
                        label: 'Response Time',
                        value: 'Within 1 business day',
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-nexgen-accent/10 flex items-center justify-center flex-shrink-0">
                          <Icon size={14} className="text-nexgen-accent" />
                        </div>
                        <div>
                          <p className="text-[10px] text-nexgen-muted uppercase tracking-wider">
                            {label}
                          </p>
                          <p className="text-sm text-nexgen-text">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionDiv>

              <MotionDiv variants={slideInRight}>
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-nexgen-text">
                    What to Expect
                  </h3>
                  <ol className="space-y-3">
                    {[
                      'Discovery call to understand your infrastructure',
                      'Tailored demo of relevant platform capabilities',
                      'Proposal with architecture & pricing',
                      'Pilot deployment on your environment',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-nexgen-accent/10 text-nexgen-accent text-xs font-mono flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-xs text-nexgen-muted leading-relaxed">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </MotionDiv>

              <MotionDiv variants={slideInRight}>
                <div className="glass-card p-6 flex items-start gap-3">
                  <Shield size={20} className="text-nexgen-green flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-nexgen-text mb-1">
                      Enterprise-Grade Security
                    </p>
                    <p className="text-[11px] text-nexgen-muted leading-relaxed">
                      SOC 2 Type II aligned. NIST SP 800-53 controls. All demo
                      environments are fully isolated.
                    </p>
                  </div>
                </div>
              </MotionDiv>
            </MotionSection>
          </div>
        </div>
      </section>
    </div>
  )
}
