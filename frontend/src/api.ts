import type {
  ActivityLogEntry,
  AdminStats,
  AuthResponse,
  Group,
  GroupMember,
  GroupPermissions,
  Item,
  ItemCreatePayload,
  ItemUpdatePayload,
  SecuritySummary,
  SessionInfo,
  User,
  UserDetailView,
  UserPage,
  UserRole,
} from "./types"

const API_BASE = "/api"
const TOKEN_STORAGE_KEY = "campus_lf_token"

type AuthKickListener = (reason?: string) => void
let onAuthKicked: AuthKickListener | null = null

export function setOnAuthKicked(listener: AuthKickListener | null): void {
  onAuthKicked = listener
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const token = getStoredToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

/**
 * Authenticated fetch wrapper:
 * - Attempts silent token rotation via POST /api/auth/refresh if a 401 occurs.
 * - Immediately logs the user out if the server rejects the token or reports "Account banned".
 */
async function apiFetch(
  input: string,
  init: RequestInit = {},
  retryOn401 = true
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: authHeaders(init.headers as Record<string, string>),
  })

  if (response.status === 401 && retryOn401 && getStoredToken()) {
    const refreshed = await tryRefreshSession()
    if (refreshed) {
      return fetch(input, {
        ...init,
        credentials: "include",
        headers: authHeaders(init.headers as Record<string, string>),
      })
    }
    setStoredToken(null)
    if (onAuthKicked) onAuthKicked("Your session expired. Please sign in again.")
  }

  if (response.status === 403 && getStoredToken()) {
    const cloned = response.clone()
    const errBody = await cloned.json().catch(() => null)
    if (
      errBody?.detail &&
      String(errBody.detail).toLowerCase().includes("account banned")
    ) {
      setStoredToken(null)
      if (onAuthKicked) onAuthKicked(String(errBody.detail))
    }
  }

  return response
}

export async function tryRefreshSession(): Promise<AuthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) return null
    const data: AuthResponse = await res.json()
    setStoredToken(data.access_token)
    return data
  } catch {
    return null
  }
}

// -------------------------------------------------------------
// 1. Lost & Found Reports CRUD API
// -------------------------------------------------------------

export async function fetchItems(filter?: {
  type?: string
  category?: string
  status?: string
  search?: string
  owner_id?: number
  group_id?: number
}): Promise<Item[]> {
  const params = new URLSearchParams()
  if (filter?.type && filter.type !== "all") params.append("type", filter.type)
  if (filter?.category && filter.category !== "all")
    params.append("category", filter.category)
  if (filter?.status && filter.status !== "all")
    params.append("status", filter.status)
  if (filter?.search) params.append("search", filter.search.trim())
  if (filter?.owner_id !== undefined)
    params.append("owner_id", String(filter.owner_id))
  if (filter?.group_id !== undefined)
    params.append("group_id", String(filter.group_id))

  const url = `${API_BASE}/items${params.toString() ? `?${params.toString()}` : ""}`
  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) {
    throw new Error(`Failed to load items (${response.status})`)
  }
  return response.json()
}

export async function fetchItem(id: number): Promise<Item> {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    headers: authHeaders(),
  })
  if (!response.ok) {
    throw new Error(`Failed to load item #${id} (${response.status})`)
  }
  return response.json()
}

export async function createItem(data: ItemCreatePayload): Promise<Item> {
  const response = await fetch(`${API_BASE}/items`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to create item (${response.status})`)
  }
  return response.json()
}

export async function updateItem(
  id: number,
  data: ItemUpdatePayload
): Promise<Item> {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to update item (${response.status})`)
  }
  return response.json()
}

export async function deleteItem(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(
      errorData?.detail || `Failed to delete item #${id} (${response.status})`
    )
  }
}

// -------------------------------------------------------------
// 2. Authentication, Sessions & Profile API
// -------------------------------------------------------------

export async function registerUser(payload: {
  name: string
  email: string
  password: string
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Registration failed (${response.status})`)
  }
  const data: AuthResponse = await response.json()
  setStoredToken(data.access_token)
  return data
}

export async function loginUser(payload: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Login failed (${response.status})`)
  }
  const data: AuthResponse = await response.json()
  setStoredToken(data.access_token)
  return data
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
  }).catch(() => null)
  setStoredToken(null)
}

export async function fetchProfile(): Promise<User> {
  const response = await apiFetch(`${API_BASE}/profile`)
  if (!response.ok) {
    throw new Error(`Not signed in (${response.status})`)
  }
  return response.json()
}

export async function updateProfile(name: string): Promise<User> {
  const response = await apiFetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to update profile")
  }
  return response.json()
}

export async function changePassword(
  current_password: string,
  new_password: string
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/profile/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password, new_password }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to change password")
  }
}

export async function fetchMySessions(): Promise<SessionInfo[]> {
  const response = await apiFetch(`${API_BASE}/auth/sessions`)
  if (!response.ok) throw new Error("Failed to load sessions")
  return response.json()
}

export async function revokeMySession(sessionId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth/sessions/${sessionId}`, {
    method: "DELETE",
  })
  if (!response.ok) throw new Error("Failed to revoke session")
}

export async function revokeOtherSessions(): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth/sessions/revoke-others`, {
    method: "POST",
  })
  if (!response.ok) throw new Error("Failed to revoke other sessions")
}

export async function revokeAllSessions(): Promise<void> {
  await apiFetch(`${API_BASE}/auth/sessions/revoke-all`, {
    method: "POST",
  })
  setStoredToken(null)
}

// -------------------------------------------------------------
// 3. Shared Recovery Groups / Teams API
// -------------------------------------------------------------

export async function fetchGroups(): Promise<Group[]> {
  const response = await apiFetch(`${API_BASE}/groups`)
  if (!response.ok) throw new Error("Failed to load groups")
  return response.json()
}

export async function createGroup(payload: {
  name: string
  description: string
}): Promise<Group> {
  const response = await apiFetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to create group")
  }
  return response.json()
}

export async function updateGroup(
  groupId: number,
  payload: { name?: string; description?: string }
): Promise<Group> {
  const response = await apiFetch(`${API_BASE}/groups/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to update group")
  }
  return response.json()
}

export async function deleteGroup(groupId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/groups/${groupId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to delete group")
  }
}

export async function fetchGroupMembers(
  groupId: number
): Promise<GroupMember[]> {
  const response = await apiFetch(`${API_BASE}/groups/${groupId}/members`)
  if (!response.ok) throw new Error("Failed to load group members")
  return response.json()
}

export async function addGroupMember(
  groupId: number,
  payload: {
    email: string
    can_create: boolean
    can_edit: boolean
    can_assign: boolean
  }
): Promise<GroupMember> {
  const response = await apiFetch(`${API_BASE}/groups/${groupId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to add member")
  }
  return response.json()
}

export async function updateGroupMemberPermissions(
  groupId: number,
  memberUserId: number,
  permissions: Partial<GroupPermissions>
): Promise<GroupMember> {
  const response = await apiFetch(
    `${API_BASE}/groups/${groupId}/members/${memberUserId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissions),
    }
  )
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to update permissions")
  }
  return response.json()
}

export async function removeGroupMember(
  groupId: number,
  memberUserId: number
): Promise<void> {
  const response = await apiFetch(
    `${API_BASE}/groups/${groupId}/members/${memberUserId}`,
    {
      method: "DELETE",
    }
  )
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error(err?.detail || "Failed to remove member")
  }
}

export async function fetchGroupItems(groupId: number): Promise<Item[]> {
  const response = await apiFetch(`${API_BASE}/groups/${groupId}/items`)
  if (!response.ok) throw new Error("Failed to load group items")
  return response.json()
}

// -------------------------------------------------------------
// 4. Admin Dashboard, Audit Log, Security View & CSV Exports
// -------------------------------------------------------------

export async function fetchAdminStats(): Promise<AdminStats> {
  const response = await apiFetch(`${API_BASE}/admin/stats`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to load stats (${response.status})`)
  }
  return response.json()
}

export async function fetchAdminUsers(params?: {
  search?: string
  role?: string
  status?: string
  offset?: number
  limit?: number
}): Promise<UserPage> {
  const q = new URLSearchParams()
  if (params?.search) q.append("search", params.search)
  if (params?.role && params.role !== "all") q.append("role", params.role)
  if (params?.status && params.status !== "all")
    q.append("status", params.status)
  if (params?.offset !== undefined) q.append("offset", String(params.offset))
  if (params?.limit !== undefined) q.append("limit", String(params.limit))

  const response = await apiFetch(
    `${API_BASE}/admin/users${q.toString() ? `?${q.toString()}` : ""}`
  )
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to load users (${response.status})`)
  }
  return response.json()
}

export async function fetchAdminUserDetail(
  userId: number
): Promise<UserDetailView> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}`)
  if (!response.ok) throw new Error("Failed to load user details")
  return response.json()
}

export async function updateUserRole(
  userId: number,
  role: UserRole
): Promise<User> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to update role")
  }
  return response.json()
}

export async function banUser(userId: number, reason?: string): Promise<User> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: reason || "Suspended by campus administrator",
    }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to ban user")
  }
  return response.json()
}

export async function unbanUser(userId: number): Promise<User> {
  const response = await apiFetch(`${API_BASE}/admin/users/${userId}/unban`, {
    method: "POST",
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to unban user")
  }
  return response.json()
}

export async function revokeUserSessionsAdmin(userId: number): Promise<void> {
  const response = await apiFetch(
    `${API_BASE}/admin/users/${userId}/revoke-sessions`,
    { method: "POST" }
  )
  if (!response.ok) throw new Error("Failed to revoke user sessions")
}

export async function bulkBanUsers(
  userIds: number[],
  reason?: string
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/users/bulk-ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ids: userIds, reason }),
  })
  if (!response.ok) throw new Error("Bulk ban failed")
}

export async function bulkUnbanUsers(userIds: number[]): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/users/bulk-unban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ids: userIds }),
  })
  if (!response.ok) throw new Error("Bulk unban failed")
}

export async function bulkDeleteItemsAdmin(itemIds: number[]): Promise<void> {
  const response = await apiFetch(`${API_BASE}/admin/items/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_ids: itemIds }),
  })
  if (!response.ok) throw new Error("Bulk delete failed")
}

export async function fetchAdminGroups(): Promise<Group[]> {
  const response = await apiFetch(`${API_BASE}/admin/groups`)
  if (!response.ok) throw new Error("Failed to load groups")
  return response.json()
}

export async function fetchAdminItems(filter?: {
  type?: string
  category?: string
  status?: string
  search?: string
}): Promise<Item[]> {
  const q = new URLSearchParams()
  if (filter?.type && filter.type !== "all") q.append("type", filter.type)
  if (filter?.category && filter.category !== "all")
    q.append("category", filter.category)
  if (filter?.status && filter.status !== "all")
    q.append("status", filter.status)
  if (filter?.search) q.append("search", filter.search.trim())

  const response = await apiFetch(
    `${API_BASE}/admin/items${q.toString() ? `?${q.toString()}` : ""}`
  )
  if (!response.ok) throw new Error("Failed to load admin items")
  return response.json()
}

export async function fetchAdminActivity(params?: {
  action?: string
  search?: string
}): Promise<ActivityLogEntry[]> {
  const q = new URLSearchParams()
  if (params?.action && params.action !== "all")
    q.append("action", params.action)
  if (params?.search) q.append("search", params.search)
  const response = await apiFetch(
    `${API_BASE}/admin/activity${q.toString() ? `?${q.toString()}` : ""}`
  )
  if (!response.ok) throw new Error("Failed to load activity log")
  return response.json()
}

export async function fetchAdminSecurity(): Promise<SecuritySummary> {
  const response = await apiFetch(`${API_BASE}/admin/security`)
  if (!response.ok) throw new Error("Failed to load security summary")
  return response.json()
}

export async function downloadAdminCsv(
  kind: "users" | "items" | "activity",
  params?: Record<string, string | undefined>
): Promise<void> {
  const q = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== "all" && v !== "All Categories") q.append(k, v)
    })
  }
  const response = await apiFetch(
    `${API_BASE}/admin/export/${kind}${q.toString() ? `?${q.toString()}` : ""}`
  )
  if (!response.ok) throw new Error(`Failed to export ${kind} CSV`)
  const csvText = await response.text()
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${kind}_export.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
