'use client'

import { useCallback, useState } from 'react'
import { Users, Plus, Shield, Trash2, X } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { getUsers, createUser, deleteUser } from '@/services/api'
import { clsx } from 'clsx'
import type { UserAccount } from '@/types'

const roleColors: Record<string, string> = {
  platform_admin: 'bg-nexgen-accent/20 text-nexgen-accent',
  operator: 'bg-nexgen-blue/20 text-nexgen-blue',
  viewer: 'bg-nexgen-green/20 text-nexgen-green',
  api_service: 'bg-nexgen-purple/20 text-nexgen-purple',
}

const roles = ['platform_admin', 'operator', 'viewer', 'api_service']

export default function UserManagementPage() {
  const fetcher = useCallback(() => getUsers(), [])
  const { data, loading, refetch } = useApi<UserAccount[]>(fetcher)
  const users = Array.isArray(data) ? data : []
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'viewer' })
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  const handleDelete = async (userId: string) => {
    setDeleting(userId)
    try {
      await deleteUser(userId)
      refetch()
    } catch { /* error */ }
    setDeleting(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formData.username || !formData.email || !formData.password) {
      setFormError('All fields are required')
      return
    }
    setCreating(true)
    try {
      await createUser(formData)
      setShowForm(false)
      setFormData({ username: '', email: '', password: '', role: 'viewer' })
      refetch()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    }
    setCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-nexgen-text flex items-center gap-2">
          <Users size={22} className="text-nexgen-accent" />
          User Management
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs py-2 px-4"><Plus size={14} /> Add User</button>
      </div>

      {/* Add User Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            className="glass-card p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-nexgen-text">Create User</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-nexgen-muted hover:text-nexgen-text"><X size={16} /></button>
            </div>
            {formError && <p className="text-xs text-nexgen-red bg-nexgen-red/10 rounded px-3 py-2">{formError}</p>}
            <div>
              <label className="block text-[10px] text-nexgen-muted uppercase mb-1">Username</label>
              <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full bg-nexgen-card border border-nexgen-border/30 rounded px-3 py-2 text-xs text-nexgen-text focus:outline-none focus:border-nexgen-accent" />
            </div>
            <div>
              <label className="block text-[10px] text-nexgen-muted uppercase mb-1">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-nexgen-card border border-nexgen-border/30 rounded px-3 py-2 text-xs text-nexgen-text focus:outline-none focus:border-nexgen-accent" />
            </div>
            <div>
              <label className="block text-[10px] text-nexgen-muted uppercase mb-1">Password</label>
              <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full bg-nexgen-card border border-nexgen-border/30 rounded px-3 py-2 text-xs text-nexgen-text focus:outline-none focus:border-nexgen-accent" />
            </div>
            <div>
              <label className="block text-[10px] text-nexgen-muted uppercase mb-1">Role</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full bg-nexgen-card border border-nexgen-border/30 rounded px-3 py-2 text-xs text-nexgen-text focus:outline-none focus:border-nexgen-accent">
                {roles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-nexgen-muted hover:text-nexgen-text rounded border border-nexgen-border/30">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary text-xs py-2 px-4 disabled:opacity-50">{creating ? 'Creating...' : 'Create User'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-nexgen-border/30 bg-nexgen-surface/50">
          <div className="col-span-3 text-[10px] font-semibold text-nexgen-muted uppercase">Username</div>
          <div className="col-span-3 text-[10px] font-semibold text-nexgen-muted uppercase">Email</div>
          <div className="col-span-2 text-[10px] font-semibold text-nexgen-muted uppercase">Role</div>
          <div className="col-span-1 text-[10px] font-semibold text-nexgen-muted uppercase">MFA</div>
          <div className="col-span-2 text-[10px] font-semibold text-nexgen-muted uppercase">Last Login</div>
          <div className="col-span-1 text-[10px] font-semibold text-nexgen-muted uppercase">Actions</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-nexgen-muted text-sm animate-pulse">Loading users...</div>
        ) : (
          users.map((user, i) => (
            <div key={user.id} className={`grid grid-cols-12 gap-4 px-5 py-3 items-center ${i < users.length - 1 ? 'border-b border-nexgen-border/20' : ''}`}>
              <div className="col-span-3 text-xs font-mono text-nexgen-text">{user.username}</div>
              <div className="col-span-3 text-xs text-nexgen-muted truncate">{user.email}</div>
              <div className="col-span-2"><span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-mono', roleColors[user.role] ?? 'bg-nexgen-card text-nexgen-muted')}>{user.role}</span></div>
              <div className="col-span-1">{user.mfa_enabled ? <Shield size={14} className="text-nexgen-green" /> : <span className="text-[10px] text-nexgen-muted">Off</span>}</div>
              <div className="col-span-2 text-[10px] text-nexgen-muted font-mono">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</div>
              <div className="col-span-1">
                <button onClick={() => handleDelete(user.id)} disabled={deleting === user.id} className="p-1.5 rounded hover:bg-nexgen-red/10 transition-colors group disabled:opacity-50">
                  <Trash2 size={12} className="text-nexgen-muted group-hover:text-nexgen-red" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && users.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Users size={40} className="text-nexgen-muted mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-nexgen-text mb-2">No Users</h3>
          <p className="text-xs text-nexgen-muted">Create your first user to get started.</p>
        </div>
      )}
    </div>
  )
}
