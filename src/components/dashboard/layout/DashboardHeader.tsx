'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, User, LogOut, Menu, Check, X, Sun, Moon, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useNotifications } from '@/hooks/useNotifications'
import { getConnectionState, onConnectionChange } from '@/services/api'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'

function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>(getConnectionState)
  useEffect(() => onConnectionChange(setState), [])
  return state
}

interface HeaderProps {
  title: string
  onMenuToggle?: () => void
}

export function DashboardHeader({ title, onMenuToggle }: HeaderProps) {
  const { user, token, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const { notifications, unreadCount, connected: wsConnected, connect, reconnect, markRead, markAllRead, dismiss } = useNotifications()
  const apiStatus = useConnectionStatus()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Overall connection: both API and WebSocket must be healthy
  const isConnected = apiStatus === 'connected' && wsConnected
  const isReconnecting = apiStatus === 'reconnecting'

  // Connect WebSocket on mount
  useEffect(() => {
    connect(token)
  }, [connect, token])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-16 bg-nexgen-surface/80 backdrop-blur-md border-b border-nexgen-border/30 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Toggle sidebar menu"
            className="lg:hidden p-2 rounded-lg hover:bg-nexgen-card transition-colors"
          >
            <Menu size={20} className="text-nexgen-text" />
          </button>
        )}
        <h2 className="text-base lg:text-lg font-semibold text-nexgen-text">{title}</h2>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Connection status + reconnect */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-nexgen-green">
              <Wifi size={14} />
              <span className="font-mono">Connected</span>
            </div>
          ) : isReconnecting ? (
            <div className="flex items-center gap-1.5 text-nexgen-amber">
              <RefreshCw size={14} className="animate-spin" />
              <span className="font-mono">Reconnecting…</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-nexgen-red">
              <WifiOff size={14} />
              <span className="font-mono">Disconnected</span>
              <button
                onClick={() => { reconnect(); window.location.reload() }}
                className="ml-1 px-2 py-0.5 rounded bg-nexgen-red/20 hover:bg-nexgen-red/30 text-nexgen-red text-[10px] font-semibold transition-colors flex items-center gap-1"
              >
                <RefreshCw size={10} />
                Reconnect
              </button>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 rounded-lg hover:bg-nexgen-card transition-colors"
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-nexgen-muted hover:text-nexgen-amber" />
          ) : (
            <Moon size={16} className="text-nexgen-muted hover:text-nexgen-accent" />
          )}
        </button>

        {/* Notifications Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            aria-label={`${unreadCount} notifications`}
            className="relative p-2 rounded-lg hover:bg-nexgen-card transition-colors"
          >
            <Bell size={18} className="text-nexgen-muted" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-nexgen-red rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 bg-nexgen-surface border border-nexgen-border/40 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-nexgen-border/20">
                  <span className="text-xs font-semibold text-nexgen-text">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-nexgen-accent hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={24} className="text-nexgen-border mx-auto mb-2" />
                      <p className="text-xs text-nexgen-muted">No notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        className={clsx(
                          'flex items-start gap-3 px-4 py-3 border-b border-nexgen-border/10 hover:bg-nexgen-card/30 transition-colors',
                          !n.read && 'bg-nexgen-accent/5',
                        )}
                      >
                        <div className={clsx(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          n.type === 'alert' ? 'bg-nexgen-red' : n.type === 'warning' ? 'bg-nexgen-amber' : n.type === 'success' ? 'bg-nexgen-green' : 'bg-nexgen-accent',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-nexgen-text truncate">{n.title}</p>
                          {n.message && <p className="text-[10px] text-nexgen-muted truncate">{n.message}</p>}
                          <p className="text-[9px] text-nexgen-muted/60 mt-0.5">{new Date(n.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!n.read && (
                            <button onClick={() => markRead(n.id)} className="p-1 rounded hover:bg-nexgen-card" title="Mark read">
                              <Check size={10} className="text-nexgen-green" />
                            </button>
                          )}
                          <button onClick={() => dismiss(n.id)} className="p-1 rounded hover:bg-nexgen-card" title="Dismiss">
                            <X size={10} className="text-nexgen-muted" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  href="/dashboard/security"
                  onClick={() => setBellOpen(false)}
                  className="block text-center py-2.5 text-[10px] text-nexgen-accent hover:bg-nexgen-card/30 border-t border-nexgen-border/20"
                >
                  View all alerts
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User info */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexgen-card/50">
          <User size={16} className="text-nexgen-accent" />
          <div className="text-right">
            <p className="text-xs font-medium text-nexgen-text">{user?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-nexgen-muted font-mono">{user?.email ?? ''}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          aria-label="Sign out"
          className="p-2 rounded-lg hover:bg-nexgen-red/10 transition-colors group"
          title="Sign out"
        >
          <LogOut size={16} className="text-nexgen-muted group-hover:text-nexgen-red" />
        </button>
      </div>
    </header>
  )
}
