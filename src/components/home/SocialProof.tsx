'use client'

import { MotionSection, MotionDiv, fadeInUp, fadeIn } from '@/components/ui/motion'

const stats = [
  { value: '99.97%', label: 'Uptime SLA' },
  { value: '<4ms', label: 'Avg. Response' },
  { value: '24/7', label: 'Autonomous Ops' },
  { value: '100%', label: 'Audit-Ready' },
]

const testimonials = [
  {
    quote:
      'Roosk replaced our entire NOC team\'s overnight shift. Incidents that took 45 minutes now resolve in under 90 seconds — autonomously.',
    name: 'Director of IT Operations',
    org: 'Regional Healthcare System',
  },
  {
    quote:
      'The compliance automation alone saved us three months of audit prep. SOC 2 readiness went from a scramble to a dashboard glance.',
    name: 'VP of Engineering',
    org: 'Mid-Market SaaS Provider',
  },
  {
    quote:
      'We went from managing 40 VMs manually to 200+ with zero additional headcount. The AI agents handle what used to take a full team.',
    name: 'CTO',
    org: 'MSP / Hosting Provider',
  },
]

const trustedBy = [
  'Healthcare', 'Financial Services', 'Manufacturing',
  'Legal', 'Education', 'Government',
]

export function SocialProof() {
  return (
    <section className="section-padding bg-nexgen-surface relative">
      <div className="section-container">
        {/* Stats Bar */}
        <MotionSection className="mb-16">
          <MotionDiv variants={fadeIn}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="text-3xl md:text-4xl font-bold font-mono gradient-text mb-1">
                    {value}
                  </p>
                  <p className="text-xs text-nexgen-muted uppercase tracking-wider">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </MotionDiv>
        </MotionSection>

        {/* Testimonials */}
        <MotionSection>
          <MotionDiv variants={fadeInUp}>
            <p className="text-nexgen-accent text-xs font-mono tracking-[0.3em] uppercase text-center mb-3">
              Trusted Results
            </p>
            <h2 className="heading-lg text-center mb-12">
              What our partners are saying
            </h2>
          </MotionDiv>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ quote, name, org }, i) => (
              <MotionDiv key={i} variants={fadeInUp}>
                <div className="glass-card p-6 h-full flex flex-col">
                  <p className="text-sm text-nexgen-text leading-relaxed flex-1 mb-5">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="border-t border-nexgen-border/20 pt-4">
                    <p className="text-xs font-semibold text-nexgen-text">{name}</p>
                    <p className="text-[10px] text-nexgen-muted">{org}</p>
                  </div>
                </div>
              </MotionDiv>
            ))}
          </div>
        </MotionSection>

        {/* Trusted By */}
        <MotionSection className="mt-16">
          <MotionDiv variants={fadeIn}>
            <p className="text-xs text-nexgen-muted text-center uppercase tracking-wider mb-6">
              Serving organizations across
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {trustedBy.map((industry) => (
                <span
                  key={industry}
                  className="px-4 py-2 rounded-full border border-nexgen-border/30 bg-nexgen-card/30 text-xs text-nexgen-muted font-mono"
                >
                  {industry}
                </span>
              ))}
            </div>
          </MotionDiv>
        </MotionSection>
      </div>
    </section>
  )
}
