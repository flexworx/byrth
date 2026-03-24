const BASE_URL = '/api'
const REQUEST_TIMEOUT = 30_000 // 30s default
const MAX_RETRIES = 2
const RETRY_DELAY = 1_000 // 1s

// Connection state — components can subscribe to this
type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'
type Listener = (state: ConnectionState) => void
let connectionState: ConnectionState = 'connected'
const listeners = new Set<Listener>()

export function getConnectionState() { return connectionState }
export function onConnectionChange(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn) } }
function setConnectionState(state: ConnectionState) {
  if (connectionState !== state) { connectionState = state; listeners.forEach((fn) => fn(state)) }
}

async function request<T>(path: string, options?: RequestInit & { retries?: number; timeout?: number }): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexgen_token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const maxRetries = options?.retries ?? MAX_RETRIES
  const timeout = options?.timeout ?? REQUEST_TIMEOUT
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(error.detail || `API Error: ${res.status}`)
      }

      setConnectionState('connected')
      return res.json()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const isNetwork = lastError.name === 'AbortError' || lastError.message.includes('fetch')

      if (isNetwork && attempt < maxRetries) {
        setConnectionState('reconnecting')
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (attempt + 1)))
        continue
      }

      if (isNetwork) setConnectionState('disconnected')
      throw lastError
    }
  }

  throw lastError!
}

// Health
export const getHealth = () => request<import('@/types').PlatformHealth>('/health')

// VMs
export const getVMs = () => request<import('@/types').VM[]>('/vms/')
export const getVM = (id: string) => request<import('@/types').VM>(`/vms/${id}`)
export const createVM = (data: Record<string, unknown>) =>
  request<import('@/types').VM>('/vms/', { method: 'POST', body: JSON.stringify(data) })
export const vmAction = (id: string, action: string, params: Record<string, unknown> = {}) =>
  request(`/vms/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, parameters: params }),
  })

// LLM
export const llmComplete = (prompt: string, context: Record<string, unknown> = {}, agentType?: string) =>
  request<{
    response: string
    backend: string
    latency_ms: number
    sanitized: boolean
    action_executed: boolean
    action_result: { action: string; success: boolean; result: Record<string, unknown>; error: string | null } | null
  }>(
    '/llm/complete',
    { method: 'POST', body: JSON.stringify({ prompt, context, agent_type: agentType || null }) },
  )
export const getLLMHealth = () =>
  request<{ bedrock: import('@/types').ServiceHealth; ollama: import('@/types').ServiceHealth }>(
    '/llm/health',
  )
export const getLLMStats = () => request<import('@/types').LLMStats>('/llm/stats')

// Security
export const getAlerts = (resolved = false) =>
  request<import('@/types').SecurityAlert[]>(`/security/alerts?resolved=${resolved}`)
export const resolveAlert = (id: string) =>
  request(`/security/alerts/${id}/resolve`, { method: 'POST' })

// Databases
export const getDatabases = () =>
  request<import('@/types').DatabaseInstance[]>('/databases/')
export const getDatabase = (id: string) =>
  request<import('@/types').DatabaseInstance>(`/databases/${id}`)
export const triggerBackup = (id: string) =>
  request(`/databases/${id}/backup`, { method: 'POST' })

// Murph.ai
export const getMurphStatus = () =>
  request<{
    platform_health: string
    vm_count: number
    alert_count: number
    services: import('@/types').ServiceHealth[]
    llm_router_status: string
  }>('/murph/status')

// Audit Logs
export const getAuditLogs = (limit = 20) =>
  request<import('@/types').AuditLogEntry[]>(`/murph/logs?limit=${limit}`)

// Agents
export const getAgents = () =>
  request<import('@/types').MurphAgent[]>('/agents/')
export const getAgent = (agentId: string) =>
  request<import('@/types').AgentDetail>(`/agents/${agentId}`)
export const deregisterAgent = (agentId: string) =>
  request(`/agents/${agentId}`, { method: 'DELETE' })
export const setAgentStatus = (agentId: string, status: 'active' | 'inactive') =>
  request<{ agent_id: string; status: string }>(`/agents/${agentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
export const dispatchAgentCommand = (agentId: string, command: string, parameters?: Record<string, unknown>) =>
  request<{ job_id: string; agent_id: string; command: string; status: string }>(`/agents/${agentId}/command`, {
    method: 'POST',
    body: JSON.stringify({ command, parameters }),
  })
export const getAgentTypes = () =>
  request<{ id: string; name: string; description: string; icon: string; capabilities: string[] }[]>('/agents/types')

// Network
export const getNetworkTopology = () =>
  request<import('@/types').NetworkTopology>('/network/topology')
export const getNetworkStorage = () =>
  request<import('@/types').StorageInfo>('/network/storage')

// Metrics
export const getSystemMetrics = () =>
  request<import('@/types').SystemMetrics>('/metrics/system')
export const getNodes = () =>
  request<{ nodes: Record<string, unknown>[] }>('/metrics/nodes')

// Compliance
export const getComplianceSummary = () =>
  request<import('@/types').ComplianceSummary>('/compliance/summary')
export const getComplianceLogs = (limit = 100, offset = 0) =>
  request<import('@/types').AuditLogEntry[]>(`/compliance/audit-logs?limit=${limit}&offset=${offset}`)

// Service Templates
export const getServiceTemplates = () =>
  request<import('@/types').ServiceTemplate[]>('/services/templates')
export const getServiceTemplate = (id: string) =>
  request<import('@/types').ServiceTemplate>(`/services/templates/${id}`)
export const deployService = (
  templateId: string,
  overrides: Record<string, unknown> = {},
) =>
  request<import('@/types').ServiceDeployment>('/services/deploy', {
    method: 'POST',
    body: JSON.stringify({ template_id: templateId, ...overrides }),
  })
export const getDeployments = () =>
  request<import('@/types').ServiceDeployment[]>('/services/deployments')

// Users
export const getUsers = () =>
  request<import('@/types').UserAccount[]>('/users/')
export const createUser = (data: { username: string; email: string; password: string; role?: string }) =>
  request<import('@/types').UserAccount>('/users/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
export const updateUser = (userId: string, data: Record<string, unknown>) =>
  request<import('@/types').UserAccount>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
export const deleteUser = (userId: string) =>
  request<{ status: string }>(`/users/${userId}`, { method: 'DELETE' })
export const resetUserPassword = (userId: string, newPassword: string) =>
  request<{ status: string }>(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  })
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ status: string }>('/users/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })

// MFA
export const setupMFA = () =>
  request<{ secret: string; provisioning_uri: string; message: string }>('/auth/mfa/setup', {
    method: 'POST',
  })
export const verifyMFA = (totpCode: string) =>
  request<{ status: string; message: string }>('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ totp_code: totpCode }),
  })
export const disableMFA = (totpCode: string) =>
  request<{ status: string; message: string }>('/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ totp_code: totpCode }),
  })

// SSH Terminal
export const getSSHHosts = () =>
  request<{ hosts: import('@/types').SSHHost[] }>('/ssh/hosts')

// Digital Chief of Staff (DCOS)
export const getDCOSMessages = (params?: { status?: string; tier?: string; limit?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.tier) q.set('tier', params.tier)
  if (params?.limit) q.set('limit', String(params.limit))
  const qs = q.toString()
  return request<{ messages: import('@/types').QCMessage[]; total: number }>(`/dcos/messages${qs ? `?${qs}` : ''}`)
}
export const ingestDCOSMessage = (msg: {
  channel: string; sender_name: string; sender_address?: string;
  subject: string; body: string; thread_id?: string
}) =>
  request<{ message_id: string; status: string; triage?: Record<string, unknown> }>('/dcos/messages?auto_triage=true', {
    method: 'POST',
    body: JSON.stringify(msg),
  })
export const triageDCOSMessage = (messageId: string) =>
  request<Record<string, unknown>>(`/dcos/messages/${messageId}/triage`, { method: 'POST' })
export const executeDCOSAction = (messageId: string) =>
  request<{ success: boolean; action: string; message_id: string }>(`/dcos/messages/${messageId}/execute`, { method: 'POST' })
export const updateDCOSDecision = (messageId: string, action: string) =>
  request<{ message_id: string; action: string }>(`/dcos/messages/${messageId}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  })
export const archiveDCOSMessage = (messageId: string) =>
  request<{ message_id: string; status: string }>(`/dcos/messages/${messageId}/archive`, { method: 'POST' })
export const deleteDCOSMessage = (messageId: string) =>
  request<{ message_id: string; deleted: boolean }>(`/dcos/messages/${messageId}`, { method: 'DELETE' })
export const getDCOSBriefings = (type?: string) =>
  request<{ briefings: import('@/types').DCOSBriefing[] }>(`/dcos/briefings${type ? `?briefing_type=${type}` : ''}`)
export const generateDCOSBriefing = (type: string = 'daily', hours: number = 24) =>
  request<import('@/types').DCOSBriefing>(`/dcos/briefings/generate?briefing_type=${type}&hours=${hours}`, { method: 'POST' })
export const getDCOSStats = () =>
  request<import('@/types').DCOSStats>('/dcos/stats')
