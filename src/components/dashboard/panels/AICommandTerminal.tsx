'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Terminal, Send, Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react'
import { llmComplete } from '@/services/api'

interface ActionResult {
  action: string
  success: boolean
  result: Record<string, unknown>
  error: string | null
}

interface TerminalEntry {
  type: 'input' | 'output' | 'error' | 'info' | 'action'
  text: string
  timestamp: string
  actionResult?: ActionResult
}

function ActionResultDisplay({ result }: { result: ActionResult }) {
  const router = useRouter()
  const actionLabels: Record<string, string> = {
    'vm.list': 'Listed VMs', 'vm.status': 'VM Status', 'vm.start': 'Started VM',
    'vm.stop': 'Stopped VM', 'vm.restart': 'Restarted VM', 'vm.create': 'Created VM',
    'service.list': 'Service Templates', 'service.deploy': 'Deployed Service',
    'db.list': 'Databases', 'db.status': 'Database Status', 'db.backup': 'Database Backup',
    'network.topology': 'Network Topology', 'network.storage': 'Storage Pools',
    'platform.health': 'Platform Health', 'platform.metrics': 'Platform Metrics',
  }
  const navTargets: Record<string, string> = {
    'vm.list': '/dashboard/vms', 'vm.start': '/dashboard/vms', 'vm.stop': '/dashboard/vms',
    'vm.create': '/dashboard/vms', 'service.list': '/dashboard/services',
    'db.list': '/dashboard/databases', 'network.topology': '/dashboard/networks',
    'platform.health': '/dashboard/monitoring',
  }

  return (
    <div className={`mt-1 rounded border p-2 ${result.success ? 'border-nexgen-accent/30 bg-nexgen-accent/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-center gap-2 mb-1">
        {result.success ? <CheckCircle2 size={12} className="text-nexgen-accent" /> : <XCircle size={12} className="text-red-400" />}
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${result.success ? 'text-nexgen-accent' : 'text-red-400'}`}>
          {actionLabels[result.action] || result.action}
        </span>
        {navTargets[result.action] && (
          <button onClick={() => router.push(navTargets[result.action]!)} className="ml-auto text-[10px] text-nexgen-accent hover:underline">
            View &rarr;
          </button>
        )}
      </div>
      {result.error && <p className="text-red-400 text-[10px]">{result.error}</p>}
      {result.success && result.result && Object.keys(result.result).length > 0 && (
        <pre className="text-[10px] text-nexgen-muted overflow-x-auto max-h-24 overflow-y-auto">
          {JSON.stringify(result.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

const AGENT_OPTIONS = [
  { id: 'generic', label: 'Murph (General)' },
  { id: 'infrastructure', label: 'Infra Agent' },
  { id: 'security', label: 'Security Agent' },
  { id: 'database', label: 'Database Agent' },
  { id: 'networking', label: 'Network Agent' },
  { id: 'daas', label: 'DaaS Agent' },
  { id: 'monitoring', label: 'Monitoring Agent' },
]

export function AICommandTerminal() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('generic')
  const [history, setHistory] = useState<TerminalEntry[]>([
    {
      type: 'info',
      text: 'Roosk NexGen Platform v2.0 — AI Action Mode (28 actions)\nType commands to manage infrastructure. Actions execute automatically.\n7 specialized agents available — select one above.',
      timestamp: new Date().toISOString(),
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [history])

  const handleSubmit = async () => {
    if (!input.trim() || loading) return
    const command = input.trim()
    setInput('')
    setHistory((h) => [...h, { type: 'input', text: command, timestamp: new Date().toISOString() }])
    setLoading(true)
    try {
      const result = await llmComplete(command, {}, selectedAgent)
      setHistory((h) => [...h, {
        type: result.action_executed ? 'action' : 'output',
        text: `[${result.backend} · ${result.latency_ms}ms${result.sanitized ? ' · sanitized' : ''}${result.action_executed ? ' · action' : ''}]\n${result.response}`,
        timestamp: new Date().toISOString(),
        actionResult: result.action_result || undefined,
      }])
    } catch (err) {
      setHistory((h) => [...h, { type: 'error', text: err instanceof Error ? err.message : 'Unknown error', timestamp: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card p-5 flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <Terminal size={16} className="text-nexgen-accent" />
        <h3 className="text-sm font-semibold text-nexgen-text">AI Command Terminal</h3>
        <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="ml-auto text-[10px] bg-nexgen-bg border border-nexgen-border/50 rounded px-2 py-1 text-nexgen-text focus:outline-none focus:border-nexgen-accent/50">
          {AGENT_OPTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <span className="flex items-center gap-1 status-badge bg-nexgen-accent/20 text-nexgen-accent">
          <Zap size={10} />28 Actions
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-nexgen-bg rounded-lg p-3 font-mono text-xs space-y-2 mb-3">
        {history.map((entry, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {entry.type === 'input' && <span className="text-nexgen-accent">{'> '}{entry.text}</span>}
            {entry.type === 'output' && <span className="text-nexgen-text">{entry.text}</span>}
            {entry.type === 'action' && <div><span className="text-nexgen-text">{entry.text}</span>{entry.actionResult && <ActionResultDisplay result={entry.actionResult} />}</div>}
            {entry.type === 'error' && <span className="text-nexgen-red">ERROR: {entry.text}</span>}
            {entry.type === 'info' && <span className="text-nexgen-muted">{entry.text}</span>}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-nexgen-accent"><Loader2 size={12} className="animate-spin" /><span>Processing via Bedrock...</span></div>}
      </div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="Try: 'Deploy a VPN server' or 'List all VMs'" className="flex-1 bg-nexgen-bg border border-nexgen-border/50 rounded-lg px-3 py-2 text-sm text-nexgen-text font-mono placeholder-nexgen-muted/50 focus:outline-none focus:border-nexgen-accent/50 transition-colors" disabled={loading} />
        <button onClick={handleSubmit} disabled={loading || !input.trim()} className="px-4 py-2 bg-nexgen-accent/20 border border-nexgen-accent/30 rounded-lg text-nexgen-accent hover:bg-nexgen-accent/30 disabled:opacity-40 transition-colors">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
