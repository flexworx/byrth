'use client'

import { useState, useRef, useEffect } from 'react'

interface CommandBarProps {
  onCommand?: (command: string) => void
}

export function CommandBar({ onCommand }: CommandBarProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setHistory((prev) => [...prev, { role: 'user', content: userMessage }])
    setExpanded(true)
    setLoading(true)

    if (onCommand) {
      onCommand(userMessage)
    }

    try {
      const token = localStorage.getItem('rooskai_token')
      const resp = await fetch('/api/proxy-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ command: userMessage }),
      })

      if (resp.ok) {
        const data = await resp.json()
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.response || data.result || JSON.stringify(data) },
        ])
      } else {
        setHistory((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${resp.status} — ${resp.statusText}` },
        ])
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800 safe-area-pb">
      {expanded && history.length > 0 && (
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto px-4 py-3 space-y-2 border-b border-zinc-800"
        >
          {history.map((msg, i) => (
            <div
              key={i}
              className={`text-sm ${
                msg.role === 'user' ? 'text-cyan-400' : 'text-zinc-300'
              }`}
            >
              <span className="text-zinc-600 mr-2">{msg.role === 'user' ? '>' : '←'}</span>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="text-sm text-zinc-500 animate-pulse">Processing...</div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
        <span className="text-cyan-500 text-sm font-mono shrink-0">roosk&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything... (e.g. 'Show me all VM status')"
          className="flex-1 bg-transparent text-white text-base placeholder:text-zinc-600 outline-none min-w-0"
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          {loading ? '...' : 'Send'}
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => {
              setExpanded(false)
              setHistory([])
            }}
            className="text-zinc-500 hover:text-zinc-300 text-sm shrink-0"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  )
}
