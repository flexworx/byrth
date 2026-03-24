'use client'

import { Check, X, Minus } from 'lucide-react'
import { MotionSection, MotionDiv } from '@/components/ui/motion'

const rows = [
  { feature: 'AI-Driven Orchestration', roosk: true, legacy: false },
  { feature: 'Natural Language Commands', roosk: true, legacy: false },
  { feature: 'Automated Incident Response', roosk: true, legacy: 'partial' },
  { feature: 'Predictive Analytics', roosk: true, legacy: false },
  { feature: 'SOC 2 Type II Compliance', roosk: true, legacy: true },
  { feature: 'NIST SP 800-53 Controls', roosk: true, legacy: 'partial' },
  { feature: 'Zero Trust Architecture', roosk: true, legacy: 'partial' },
  { feature: 'Immutable Audit Logs', roosk: true, legacy: false },
  { feature: 'Sub-Second Alert Triage', roosk: true, legacy: false },
  { feature: 'Self-Healing Infrastructure', roosk: true, legacy: false },
]

function StatusIcon({ status }: { status: boolean | string }) {
  if (status === true) return <Check size={16} className="text-nexgen-green" />
  if (status === 'partial') return <Minus size={16} className="text-nexgen-amber" />
  return <X size={16} className="text-nexgen-red/60" />
}

export function ServiceComparison() {
  return (
    <MotionSection className="section-padding bg-nexgen-bg">
      <div className="section-container">
        <MotionDiv className="text-center mb-16">
          <span className="text-xs font-mono text-nexgen-accent uppercase tracking-[0.2em] mb-4 block">
            Comparison
          </span>
          <h2 className="heading-lg mb-4">
            Roosk vs. legacy MSPs.
          </h2>
          <p className="body-md max-w-xl mx-auto">
            Traditional managed service providers react to problems.
            Roosk prevents them.
          </p>
        </MotionDiv>

        <div className="max-w-2xl mx-auto">
          <div className="glass-card overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-nexgen-border/30 bg-nexgen-surface/50">
              <div className="text-xs font-semibold text-nexgen-muted uppercase tracking-wider">
                Capability
              </div>
              <div className="text-xs font-semibold text-nexgen-accent uppercase tracking-wider text-center">
                Roosk
              </div>
              <div className="text-xs font-semibold text-nexgen-muted uppercase tracking-wider text-center">
                Legacy MSP
              </div>
            </div>

            {/* Rows */}
            {rows.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 gap-4 px-6 py-3 ${
                  i < rows.length - 1 ? 'border-b border-nexgen-border/20' : ''
                }`}
              >
                <div className="text-sm text-nexgen-text">{row.feature}</div>
                <div className="flex justify-center">
                  <StatusIcon status={row.roosk} />
                </div>
                <div className="flex justify-center">
                  <StatusIcon status={row.legacy} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MotionSection>
  )
}
