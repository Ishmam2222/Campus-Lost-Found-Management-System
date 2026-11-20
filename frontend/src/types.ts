export type ItemType = "lost" | "found"
export type ItemStatus = "active" | "claimed" | "resolved"
export type UserRole = "user" | "member" | "admin"
export type AppPage = "board" | "groups" | "login" | "signup" | "profile" | "admin"

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_banned: boolean
  banned_at?: string | null
  ban_reason?: string | null
  last_login_at?: string | null
  created_at: string
}

export interface SessionInfo {
  id: number
  user_id: number
  ip_address: string
  user_agent: string
  created_at: string
  last_used_at: string
  expires_at: string
  revoked_at?: string | null
  is_current: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface GroupPermissions {
  can_create: boolean
  can_edit: boolean
  can_assign: boolean
}

export interface Group {
  id: number
  name: string
  description: string
  owner_id: number
  owner_name: string
  created_at: string
  member_count: number
  my_role?: "owner" | "member" | null
  my_permissions?: GroupPermissions | null
}

export interface GroupMember {
  id: number
  group_id: number
  user_id: number
  user_name: string
  user_email: string
  group_role: "owner" | "member"
  can_create: boolean
  can_edit: boolean
  can_assign: boolean
  joined_at: string
}

export interface AdminStats {
  total_users: number
  admin_users: number
  banned_users: number
  new_users_7d: number
  total_items: number
  lost_items: number
  found_items: number
  claimed_items: number
  new_items_7d: number
  total_groups: number
}

export interface UserPage {
  items: User[]
  total: number
  offset: number
  limit: number
}

export interface ActivityLogEntry {
  id: number
  user_id?: number | null
  user_email: string
  action: string
  entity_type: string
  entity_id?: string | null
  detail: string
  ip_address: string
  user_agent: string
  created_at: string
}

export interface UserDetailView {
  user: User
  items: Item[]
  groups: Group[]
  sessions: SessionInfo[]
  recent_activity: ActivityLogEntry[]
}

export interface FailedLoginBucket {
  key: string
  count: number
  last_seen?: string | null
}

export interface SecuritySummary {
  failed_by_ip: FailedLoginBucket[]
  failed_by_account: FailedLoginBucket[]
  recent_security_events: ActivityLogEntry[]
}

export interface Item {
  id: number
  type: ItemType
  title: string
  category: string
  location: string
  description: string
  contact_info: string
  status: ItemStatus
  owner_id?: number | null
  owner_name?: string
  group_id?: number | null
  assignee_id?: number | null
  assignee_name?: string | null
  created_at: string
}

export interface ItemCreatePayload {
  type: ItemType
  title: string
  category: string
  location: string
  description: string
  contact_info: string
  status?: ItemStatus
  group_id?: number | null
  assignee_id?: number | null
}

export type ItemUpdatePayload = Partial<ItemCreatePayload>
