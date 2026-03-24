'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Shield, Loader2, AlertCircle, KeyRound } from 'lucide-react'

export function LoginPage() {
  const { login, mfaLogin } = useAuth()
  const [email, setEmail] = useState('admin@flexworx.io')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaToken, setMfaToken] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password)
      if (result.success) return
      if (result.mfa_required && result.mfa_token) {
        setMfaRequired(true)
        setMfaToken(result.mfa_token)
        setLoading(false)
        return
      }
      setError('Invalid credentials. Check email and password.')
    } catch {
      setError('Unable to connect to server.')
    }
    setLoading(false)
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const success = await mfaLogin(mfaToken, totpCode)
      if (!success) setError('Invalid TOTP code. Try again.')
    } catch {
      setError('MFA verification failed.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-nexgen-bg flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-grid-pattern bg-grid-60 opacity-40" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-nexgen-accent to-nexgen-blue glow-accent-strong mb-4">
            <span className="text-white font-bold text-2xl font-mono">R</span>
          </div>
          <h1 className="text-2xl font-bold text-nexgen-text tracking-wide">ROOSK</h1>
          <p className="text-xs text-nexgen-muted tracking-[0.3em] uppercase mt-1">
            NexGen Operations Center
          </p>
        </div>

        {/* Login card */}
        <div className="glass-card p-8 glow-accent">
          <div className="flex items-center gap-2 mb-6">
            {mfaRequired ? (
              <KeyRound size={18} className="text-nexgen-accent" />
            ) : (
              <Shield size={18} className="text-nexgen-accent" />
            )}
            <h2 className="text-sm font-semibold text-nexgen-text">
              {mfaRequired ? 'MFA Verification' : 'Secure Login'}
            </h2>
            <span className="ml-auto text-[10px] text-nexgen-muted font-mono">
              {mfaRequired ? 'TOTP' : 'TLS 1.3'}
            </span>
          </div>

          {!mfaRequired ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-nexgen-muted uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-nexgen-bg border border-nexgen-border/50 rounded-lg px-4 py-2.5 text-sm text-nexgen-text font-mono placeholder-nexgen-muted/40 focus:outline-none focus:border-nexgen-accent/50 transition-colors"
                  placeholder="admin@flexworx.io"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs text-nexgen-muted uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-nexgen-bg border border-nexgen-border/50 rounded-lg px-4 py-2.5 text-sm text-nexgen-text font-mono placeholder-nexgen-muted/40 focus:outline-none focus:border-nexgen-accent/50 transition-colors"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexgen-red/10 border border-nexgen-red/30">
                  <AlertCircle size={14} className="text-nexgen-red shrink-0" />
                  <span className="text-xs text-nexgen-red">{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-nexgen-accent to-nexgen-blue rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Authenticating...</> : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <p className="text-xs text-nexgen-muted">Enter the 6-digit code from your authenticator app.</p>
              <div>
                <label className="block text-xs text-nexgen-muted uppercase tracking-wider mb-1.5">TOTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-nexgen-bg border border-nexgen-border/50 rounded-lg px-4 py-2.5 text-center text-lg text-nexgen-text font-mono tracking-[0.5em] placeholder-nexgen-muted/40 focus:outline-none focus:border-nexgen-accent/50 transition-colors"
                  placeholder="000000"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexgen-red/10 border border-nexgen-red/30">
                  <AlertCircle size={14} className="text-nexgen-red shrink-0" />
                  <span className="text-xs text-nexgen-red">{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full py-2.5 bg-gradient-to-r from-nexgen-accent to-nexgen-blue rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify Code'}
              </button>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaToken(''); setTotpCode(''); setError('') }}
                className="w-full text-xs text-nexgen-muted hover:text-nexgen-text transition-colors"
              >
                Back to login
              </button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-nexgen-border/20">
            <p className="text-[10px] text-nexgen-muted text-center">
              {mfaRequired
                ? 'MFA protects your account with time-based one-time passwords.'
                : 'MFA available — enable TOTP in Settings after login.'}
            </p>
          </div>
        </div>

        <div className="text-center mt-6 space-y-1">
          <p className="text-[10px] text-nexgen-muted font-mono">
            Dell PowerEdge R7625 &middot; 2x EPYC 9354 &middot; 128GB
          </p>
          <p className="text-[10px] text-nexgen-muted/50">
            SOC 2 Type II &middot; NIST SP 800-53 &middot; Zero Trust
          </p>
        </div>
      </div>
    </div>
  )
}
