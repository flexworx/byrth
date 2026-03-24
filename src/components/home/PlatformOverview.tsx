'use client'

import { Brain, Eye, Zap, ShieldCheck } from 'lucide-react'
import { MotionSection, MotionDiv, fadeInUp } from '@/components/ui/motion'

const pillars = [
  {
    icon: Brain,
    title: 'AI-Driven Orchestration',
    description:
      'CentralIntel.ai interprets natural-language instructions into infrastructure actions. Deploy VMs, configure firewalls, and provision databases through conversation.',
    color: 'from-nexgen-accent to-nexgen-blue',
  },
  {
    icon: Eye,
    title: 'Predictive Network Intelligence',
    description:
      'Continuous analysis of network telemetry identifies anomalies before they become outages. Carrier intelligence correlates ISP performance across your entire topology.',
    color: 'from-nexgen-blue to-nexgen-purple',
  },
  {
    icon: Zap,
    title: 'Automated Incident Response',
    description:
      'When an alert fires, the platform does not wait for a human. Policy-driven automation executes runbooks, isolates threats, and restores services within seconds.',
    color: 'from-nexgen-purple to-nexgen-accent',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance by Design',
    description:
      'Every action is audit-logged. SOC 2 Type II and NIST SP 800-53 controls are enforced at the infrastructure layer, not bolted on as an afterthought.',
    color: 'from-nexgen-green to-nexgen-accent',
  },
]

export function PlatformOverview() {
  return (
    <MotionSection className="section-padding bg-nexgen-bg">
      <div className="section-container">
        <MotionDiv className="text-center mb-16">
          <span className="text-xs font-mono text-nexgen-accent uppercase tracking-[0.2em] mb-4 block">
            Why Roosk
          </span>
          <h2 className="heading-lg mb-4">
            Not another MSP.
            <br />
            <span className="gradient-text">An intelligence platform.</span>
          </h2>
          <p className="body-md max-w-2xl mx-auto">
            Legacy managed service providers react to tickets. Roosk operates
            autonomously — predicting, preventing, and resolving infrastructure
            issues before your team even notices.
          </p>
        </MotionDiv>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((pillar) => (
            <MotionDiv
              key={pillar.title}
              variants={fadeInUp}
              className="glass-card-hover p-8 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <pillar.icon size={22} className="text-white" />
              </div>
              <h3 className="heading-md mb-3">{pillar.title}</h3>
              <p className="body-md">{pillar.description}</p>
            </MotionDiv>
          ))}
        </div>
      </div>
    </MotionSection>
  )
}
