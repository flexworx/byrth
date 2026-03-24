'use client'

import { ServiceCard } from './ServiceCard'

const services = [
  {
    name: 'Dashboard',
    description: 'VM management, metrics, and infrastructure overview',
    url: 'https://www.roosk.ai/dashboard',
    icon: '📊',
    internalUrl: 'http://10.20.0.10:3000',
  },
  {
    name: 'Code Editor',
    description: 'Browser-based VS Code with full workspace access',
    url: 'https://code.roosk.ai',
    icon: '💻',
    internalUrl: 'http://10.20.0.10:8443',
  },
  {
    name: 'File Explorer',
    description: 'Browse and manage files across all VMs',
    url: 'https://files.roosk.ai',
    icon: '📁',
    internalUrl: 'http://10.20.0.10:8080',
  },
  {
    name: 'AI Agents',
    description: 'SwedBot natural language infrastructure control',
    url: 'https://agent.roosk.ai',
    icon: '🤖',
    internalUrl: 'http://10.20.0.40:18789',
  },
  {
    name: 'Git Repos',
    description: 'Self-hosted Git with FlexWorx repositories',
    url: 'https://git.roosk.ai',
    icon: '🔀',
    internalUrl: 'http://10.20.0.30:3000',
  },
  {
    name: 'Monitoring',
    description: 'Grafana dashboards with real-time metrics',
    url: 'https://monitor.roosk.ai',
    icon: '📈',
    internalUrl: 'http://10.10.0.50:3000',
  },
  {
    name: 'Security',
    description: 'Wazuh SIEM — alerts, compliance, file integrity',
    url: 'https://security.roosk.ai',
    icon: '🛡️',
    internalUrl: 'https://10.10.0.40:443',
  },
  {
    name: 'Secrets Vault',
    description: 'HashiCorp Vault — secrets and credential management',
    url: 'https://vault.roosk.ai',
    icon: '🔐',
    internalUrl: 'http://10.10.0.30:8200',
  },
  {
    name: 'Auth & Users',
    description: 'Keycloak identity management and SSO',
    url: 'https://auth.roosk.ai',
    icon: '👤',
    internalUrl: 'http://10.10.0.20:8080',
  },
]

export function PortalGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {services.map((service) => (
        <ServiceCard key={service.name} {...service} />
      ))}
    </div>
  )
}
