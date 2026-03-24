'use client'

import { useState, useEffect } from 'react'

interface ServiceCardProps {
  name: string
  description: string
  url: string
  icon: string
  internalUrl?: string
}

export function ServiceCard({ name, description, url, icon, internalUrl }: ServiceCardProps) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    if (!internalUrl) {
      setStatus('online')
      return
    }

    const checkHealth = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const resp = await fetch(`/api/proxy-health?target=${encodeURIComponent(internalUrl)}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        setStatus(resp.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [internalUrl])

  const statusColor = {
    checking: 'bg-yellow-400',
    online: 'bg-emerald-400',
    offline: 'bg-red-400',
  }[status]

  const statusLabel = {
    checking: 'Checking...',
    online: 'Online',
    offline: 'Offline',
  }[status]

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-cyan-500/50 hover:bg-zinc-800/80 transition-all duration-200 min-h-[160px]"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl" role="img" aria-label={name}>
          {icon}
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-xs text-zinc-500">{statusLabel}</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
        {name}
      </h3>
      <p className="text-sm text-zinc-400 leading-relaxed flex-1">{description}</p>

      <div className="mt-3 text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors truncate">
        {url}
      </div>
    </a>
  )
}
