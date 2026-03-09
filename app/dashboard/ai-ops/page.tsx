'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Brain, Send, Loader2, Zap, CheckCircle2, XCircle, Server, Database,
  Shield, Network, Bot, Activity, Boxes, Terminal, ArrowRight, Sparkles,
  FileText, HelpCircle, Maximize2, Minimize2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { llmComplete } from '@/services/api'

interface ActionResult {
  action: string
  success: boolean
  result: Record<string, unknown>
  error: string | null
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  actionResult?: ActionResult
  agent?: string
}

const QUICK_ACTIONS = [
  { label: 'List all VMs', prompt: 'List all virtual machines with their current status', icon: Server },
  { label: 'Deploy VPN', prompt: 'Deploy a WireGuard VPN server', icon: Shield },
  { label: 'Create a VM', prompt: 'Create a new Ubuntu VM with 4 CPU cores, 8GB RAM, and 100GB disk', icon: Server },
  { label: 'Deploy website', prompt: 'Deploy a new web server with Nginx and Let\'s Encrypt SSL', icon: Boxes },
  { label: 'Check health', prompt: 'Show me the current platform health status and resource usage', icon: Activity },
  { label: 'Security scan', prompt: 'Show all unresolved security alerts and recommend actions', icon: Shield },
  { label: 'Database backup', prompt: 'Show database status and trigger a backup', icon: Database },
  { label: 'Network topology', prompt: 'Show me the current network topology and VLAN layout', icon: Network },
  { label: 'Deploy dev env', prompt: 'Deploy a complete development environment with VS Code Server', icon: Terminal },
  { label: 'Clone a VM', prompt: 'Clone an existing VM for testing purposes', icon: Server },
  { label: 'Audit logs', prompt: 'Show the last 20 audit log entries', icon: FileText },
  { label: 'AI agents', prompt: 'List all active AI agents and their current status', icon: Bot },
]

const AGENT_OPTIONS = [
  { id: 'generic', label: 'Murph (General)', icon: Brain, desc: 'Full-stack AI operations assistant' },
  { id: 'infrastructure', label: 'Infra Agent', icon: Server, desc: 'VM, compute, and storage management' },
  { id: 'security', label: 'Security Agent', icon: Shield, desc: 'Threat detection and response' },
  { id: 'database', label: 'Database Agent', icon: Database, desc: 'PostgreSQL, backups, replication' },
  { id: 'networking', label: 'Network Agent', icon: Network, desc: 'VLAN, firewall, Cato SASE' },
  { id: 'daas', label: 'DaaS Agent', icon: Boxes, desc: 'Desktop-as-a-Service deployments' },
  { id: 'monitoring', label: 'Monitoring Agent', icon: Activity, desc: 'Prometheus, Grafana, alerts' },
]

function ActionResultDisplay({ result }: { result: ActionResult }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const navTargets: Record<string, string> = {
    'vm.list': '/dashboard/vms', 'vm.start': '/dashboard/vms', 'vm.stop': '/dashboard/vms',
    'vm.create': '/dashboard/vms', 'service.list': '/dashboard/services',
    'db.list': '/dashboard/databases', 'network.topology': '/dashboard/networks',
    'platform.health': '/dashboard/monitoring', 'log.security': '/dashboard/security',
    'log.audit': '/dashboard/audit-logs',
  }

  return (
    <div className={clsx('mt-2 rounded-lg border p-3', result.success ? 'border-nexgen-green/30 bg-nexgen-green/5' : 'border-nexgen-red/30 bg-nexgen-red/5')}>
      <div className="flex items-center gap-2 mb-2">
        {result.success ? <CheckCircle2 size={14} className="text-nexgen-green" /> : <XCircle size={14} className="text-nexgen-red" />}
        <span className={clsx('text-xs font-mono font-semibold', result.success ? 'text-nexgen-green' : 'text-nexgen-red')}>
          {result.action}
        </span>
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', result.success ? 'bg-nexgen-green/20 text-nexgen-green' : 'bg-nexgen-red/20 text-nexgen-red')}>
          {result.success ? 'SUCCESS' : 'FAILED'}
        </span>
        {navTargets[result.action] && (
          <button onClick={() => router.push(navTargets[result.action]!)} className="ml-auto text-[10px] text-nexgen-accent hover:underline flex items-center gap-1">
            View <ArrowRight size={8} />
          </button>
        )}
      </div>
      {result.error && <p className="text-nexgen-red text-xs">{result.error}</p>}
      {result.success && result.result && Object.keys(result.result).length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-nexgen-muted hover:text-nexgen-text flex items-center gap-1 mb-1">
            {expanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            {expanded ? 'Collapse' : 'Expand'} result
          </button>
          {expanded && (
            <pre className="text-[10px] text-nexgen-muted font-mono overflow-x-auto max-h-40 overflow-y-auto bg-nexgen-bg/50 rounded p-2">
              {JSON.stringify(result.result, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

export default function AIOpsConsolePage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('generic')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: `Welcome to the Byrth AI Operations Console. I'm your AI-powered infrastructure assistant with 28 executable actions.

I can help you:
- **Create, manage, and monitor VMs** — spin up servers, resize resources, take snapshots
- **Deploy services** — VPN, web servers, dev environments, Windows desktops
- **Manage databases** — status checks, backups, replication monitoring
- **Security operations** — alerts, incident response, compliance checks
- **Network management** — topology, VLANs, storage pools
- **Platform monitoring** — health, metrics, audit logs

Just tell me what you want to build or manage in plain English.`,
      timestamp: new Date().toISOString(),
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async (prompt?: string) => {
    const command = prompt || input.trim()
    if (!command || loading) return
    setInput('')

    setMessages((m) => [...m, { role: 'user', content: command, timestamp: new Date().toISOString() }])
    setLoading(true)

    try {
      const result = await llmComplete(command, {}, selectedAgent)
      const responseText = result.action_executed
        ? `${result.response}`
        : result.response

      setMessages((m) => [...m, {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
        actionResult: result.action_result || undefined,
        agent: selectedAgent,
      }])
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to connect to AI backend. Ensure the FastAPI server is running.'}`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, selectedAgent])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-nexgen-text flex items-center gap-2">
            <Brain size={22} className="text-nexgen-accent" />
            AI Operations Console
          </h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-nexgen-accent/10 text-nexgen-accent text-[10px] font-mono">
            <Zap size={10} />28 Actions
          </span>
        </div>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          {AGENT_OPTIONS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              title={agent.desc}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                selectedAgent === agent.id
                  ? 'bg-nexgen-accent/20 text-nexgen-accent border border-nexgen-accent/30'
                  : 'text-nexgen-muted hover:text-nexgen-text hover:bg-nexgen-card'
              )}
            >
              <agent.icon size={12} />
              <span className="hidden sm:inline">{agent.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-nexgen-bg/50 rounded-xl border border-nexgen-border/20 p-4 space-y-4 mb-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={clsx(
                'max-w-[85%] rounded-xl px-4 py-3',
                msg.role === 'user' && 'bg-nexgen-accent/20 border border-nexgen-accent/20',
                msg.role === 'assistant' && 'bg-nexgen-surface border border-nexgen-border/20',
                msg.role === 'system' && 'bg-nexgen-card/50 border border-nexgen-border/10 w-full max-w-full',
              )}>
                {msg.role === 'assistant' && msg.agent && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot size={10} className="text-nexgen-accent" />
                    <span className="text-[9px] font-mono text-nexgen-accent">
                      {AGENT_OPTIONS.find((a) => a.id === msg.agent)?.label || 'AI'}
                    </span>
                  </div>
                )}
                <div className="text-xs text-nexgen-text whitespace-pre-wrap leading-relaxed prose-sm">
                  {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j} className="text-nexgen-text font-semibold">{part.slice(2, -2)}</strong>
                      : <span key={j}>{part}</span>
                  )}
                </div>
                {msg.actionResult && <ActionResultDisplay result={msg.actionResult} />}
                <span className="text-[9px] text-nexgen-muted/50 mt-2 block">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-nexgen-surface border border-nexgen-border/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-nexgen-accent" />
              <span className="text-xs text-nexgen-muted">Processing via Bedrock...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="mb-4">
          <p className="text-[10px] text-nexgen-muted mb-2 flex items-center gap-1">
            <Sparkles size={10} className="text-nexgen-accent" /> Quick Actions — click to execute
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => handleSubmit(qa.prompt)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-nexgen-surface border border-nexgen-border/20 text-xs text-nexgen-text hover:border-nexgen-accent/30 hover:bg-nexgen-accent/5 transition-all text-left"
              >
                <qa.icon size={14} className="text-nexgen-accent flex-shrink-0" />
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Tell Byrth what to build, deploy, or manage..."
            className="w-full bg-nexgen-surface border border-nexgen-border/40 rounded-xl px-4 py-3 text-sm text-nexgen-text placeholder-nexgen-muted/50 focus:outline-none focus:border-nexgen-accent/50 transition-colors pr-10"
            disabled={loading}
          />
          <button
            onClick={() => {/* help tooltip */}}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            title="Examples: 'Create a VM', 'Deploy a VPN', 'Show security alerts'"
          >
            <HelpCircle size={14} className="text-nexgen-muted/40" />
          </button>
        </div>
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-nexgen-accent/20 border border-nexgen-accent/30 rounded-xl text-nexgen-accent hover:bg-nexgen-accent/30 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
