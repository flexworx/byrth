import type { Metadata } from 'next'
import { PortalGrid } from '@/components/portal/PortalGrid'
import { CommandBar } from '@/components/portal/CommandBar'

export const metadata: Metadata = {
  title: 'RooskAI Portal — Service Directory',
  description: 'Unified access to all RooskAI platform services',
}

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg">
              R
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">RooskAI Platform</h1>
              <p className="text-sm text-zinc-400">Dell PowerEdge R7625 — 10 VMs — Proxmox 9.1</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-24">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">Services</h2>
          <PortalGrid />
        </div>
      </main>

      <CommandBar />
    </div>
  )
}
