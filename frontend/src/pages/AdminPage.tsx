import { useEffect, useState } from "react"
import {
  banUser,
  bulkBanUsers,
  bulkDeleteItemsAdmin,
  bulkUnbanUsers,
  deleteGroup,
  deleteItem,
  downloadAdminCsv,
  fetchAdminActivity,
  fetchAdminGroups,
  fetchAdminItems,
  fetchAdminSecurity,
  fetchAdminStats,
  fetchAdminUserDetail,
  fetchAdminUsers,
  revokeUserSessionsAdmin,
  unbanUser,
  updateUserRole,
} from "../api"
import { CATEGORIES } from "../components/FilterBar"
import type {
  ActivityLogEntry,
  AdminStats,
  Group,
  Item,
  SecuritySummary,
  User,
  UserDetailView,
  UserRole,
} from "../types"

interface AdminPageProps {
  currentUser: User
  onItemsChanged: () => void
}

type AdminTab = "users" | "content" | "activity" | "security"

export default function AdminPage({
  currentUser,
  onItemsChanged,
}: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users")
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState("")

  // Users tab state
  const [users, setUsers] = useState<User[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("all")
  const [userStatusFilter, setUserStatusFilter] = useState("all")
  const [userOffset, setUserOffset] = useState(0)
  const userLimit = 10
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [inspectingUser, setInspectingUser] = useState<UserDetailView | null>(
    null
  )

  // Content moderation tab state
  const [modItems, setModItems] = useState<Item[]>([])
  const [modGroups, setModGroups] = useState<Group[]>([])
  const [modSearch, setModSearch] = useState("")
  const [modType, setModType] = useState("all")
  const [modCategory, setModCategory] = useState("All Categories")
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])

  // Activity log tab state
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [actAction, setActAction] = useState("all")
  const [actSearch, setActSearch] = useState("")

  // Security view tab state
  const [securityData, setSecurityData] = useState<SecuritySummary | null>(null)

  async function loadStats() {
    try {
      setStats(await fetchAdminStats())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats")
    }
  }

  async function loadUsers() {
    try {
      const page = await fetchAdminUsers({
        search: userSearch,
        role: userRoleFilter,
        status: userStatusFilter,
        offset: userOffset,
        limit: userLimit,
      })
      setUsers(page.items)
      setUserTotal(page.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users")
    }
  }

  async function loadContent() {
    try {
      const [itemsList, groupsList] = await Promise.all([
        fetchAdminItems({
          type: modType,
          category: modCategory === "All Categories" ? undefined : modCategory,
          search: modSearch,
        }),
        fetchAdminGroups(),
      ])
      setModItems(itemsList)
      setModGroups(groupsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content")
    }
  }

  async function loadActivity() {
    try {
      const list = await fetchAdminActivity({
        action: actAction,
        search: actSearch,
      })
      setActivityLogs(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity")
    }
  }

  async function loadSecurity() {
    try {
      setSecurityData(await fetchAdminSecurity())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security view")
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    loadUsers()
  }, [userSearch, userRoleFilter, userStatusFilter, userOffset])

  useEffect(() => {
    if (activeTab === "content") loadContent()
    if (activeTab === "activity") loadActivity()
    if (activeTab === "security") loadSecurity()
  }, [activeTab, modSearch, modType, modCategory, actAction, actSearch])

  async function handleInspectUser(userId: number) {
    try {
      const detail = await fetchAdminUserDetail(userId)
      setInspectingUser(detail)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to inspect user")
    }
  }

  async function handleRoleToggle(target: User) {
    const nextRole: UserRole = target.role === "admin" ? "user" : "admin"
    try {
      await updateUserRole(target.id, nextRole)
      loadUsers()
      loadStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to change role")
    }
  }

  async function handleBanToggle(target: User) {
    try {
      if (target.is_banned) {
        await unbanUser(target.id)
      } else {
        const reason =
          window.prompt(
            `Reason for banning ${target.email}:`,
            "Violation of campus reporting policy"
          ) || "Suspended by administrator"
        await banUser(target.id, reason)
      }
      loadUsers()
      loadStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update ban status")
    }
  }

  async function handleBulkBan() {
    if (selectedUserIds.length === 0) return
    const reason =
      window.prompt(
        `Ban ${selectedUserIds.length} selected user(s)? Enter reason:`,
        "Bulk moderation suspension"
      ) || "Bulk moderation suspension"
    try {
      await bulkBanUsers(selectedUserIds, reason)
      setSelectedUserIds([])
      loadUsers()
      loadStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk ban failed")
    }
  }

  async function handleBulkUnban() {
    if (selectedUserIds.length === 0) return
    try {
      await bulkUnbanUsers(selectedUserIds)
      setSelectedUserIds([])
      loadUsers()
      loadStats()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk unban failed")
    }
  }

  async function handleBulkDeleteItems() {
    if (selectedItemIds.length === 0) return
    if (
      !window.confirm(`Delete ${selectedItemIds.length} selected report(s)?`)
    )
      return
    try {
      await bulkDeleteItemsAdmin(selectedItemIds)
      setSelectedItemIds([])
      loadContent()
      loadStats()
      onItemsChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk delete failed")
    }
  }

  async function handleDeleteSingleItem(id: number) {
    try {
      await deleteItem(id)
      loadContent()
      loadStats()
      onItemsChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function handleDeleteGroupAdmin(groupId: number) {
    if (!window.confirm("Delete this group and all its reports?")) return
    try {
      await deleteGroup(groupId)
      loadContent()
      loadStats()
      onItemsChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete group")
    }
  }

  return (
    <div className="dashboard-section">
      {/* Top Overview Stats Card */}
      <div className="panel-card">
        <div className="panel-header-row">
          <div>
            <h2>🛡️ Campus Administration &amp; Security Center</h2>
            <p className="panel-subtitle">
              Overview statistics, user RBAC management, content moderation,
              audit trail, and CSV exports
            </p>
          </div>
          <button
            className="btn btn-outline"
            onClick={() => {
              loadStats()
              loadUsers()
            }}
          >
            ↻ Refresh Dashboard
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {stats && (
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-value">{stats.total_users}</span>
              <span className="stat-label">
                Users (+{stats.new_users_7d} in 7d)
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.admin_users}</span>
              <span className="stat-label">Admins</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.banned_users}</span>
              <span className="stat-label">Banned Users</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.total_items}</span>
              <span className="stat-label">
                Reports (+{stats.new_items_7d} in 7d)
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.lost_items}</span>
              <span className="stat-label">🔴 Lost</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.found_items}</span>
              <span className="stat-label">🟢 Found</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{stats.total_groups}</span>
              <span className="stat-label">🤝 Recovery Groups</span>
            </div>
          </div>
        )}

        {/* Admin Section Tabs */}
        <div className="tabs" style={{ marginTop: "20px" }}>
          <button
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Users &amp; Roles
          </button>
          <button
            className={`tab-btn ${activeTab === "content" ? "active" : ""}`}
            onClick={() => setActiveTab("content")}
          >
            📦 Content Moderation
          </button>
          <button
            className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            📜 Activity Audit Log
          </button>
          <button
            className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            🚨 Security Monitor
          </button>
        </div>
      </div>

      {/* TAB 1: USERS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="panel-card" style={{ marginTop: "20px" }}>
          <div className="panel-header-row">
            <h3>👥 Registered Accounts ({userTotal})</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {selectedUserIds.length > 0 && (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleBulkBan}
                  >
                    Bulk Ban ({selectedUserIds.length})
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleBulkUnban}
                  >
                    Bulk Unban ({selectedUserIds.length})
                  </button>
                </>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  downloadAdminCsv("users", {
                    search: userSearch,
                    role: userRoleFilter,
                    status: userStatusFilter,
                  })
                }
              >
                ⬇ Export Users CSV
              </button>
            </div>
          </div>

          <div className="filters-group" style={{ marginBottom: "14px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search name or email..."
              value={userSearch}
              onChange={(e) => {
                setUserOffset(0)
                setUserSearch(e.target.value)
              }}
            />
            <select
              className="select-input"
              value={userRoleFilter}
              onChange={(e) => {
                setUserOffset(0)
                setUserRoleFilter(e.target.value)
              }}
            >
              <option value="all">All Roles</option>
              <option value="user">User / Member</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="select-input"
              value={userStatusFilter}
              onChange={(e) => {
                setUserOffset(0)
                setUserStatusFilter(e.target.value)
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>ID</th>
                  <th>Name &amp; Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id
                  const checked = selectedUserIds.includes(u.id)
                  return (
                    <tr key={u.id}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={isSelf || u.role === "admin"}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedUserIds([...selectedUserIds, u.id])
                            else
                              setSelectedUserIds(
                                selectedUserIds.filter((id) => id !== u.id)
                              )
                          }}
                        />
                      </td>
                      <td>#{u.id}</td>
                      <td>
                        <strong>{u.name}</strong>
                        {isSelf && <span className="you-tag">(You)</span>}
                        <br />
                        <span className="text-muted">{u.email}</span>
                      </td>
                      <td>
                        <span className={`role-tag role-${u.role}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {u.is_banned ? (
                          <span className="badge badge-lost">
                            BANNED ({u.ban_reason})
                          </span>
                        ) : (
                          <span className="badge badge-status badge-status-active">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="card-buttons">
                          <button
                            className="btn-link"
                            onClick={() => handleInspectUser(u.id)}
                          >
                            Inspect
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                className="btn-link"
                                onClick={() => handleRoleToggle(u)}
                              >
                                {u.role === "admin"
                                  ? "Make User"
                                  : "Make Admin"}
                              </button>
                              {u.role !== "admin" && (
                                <button
                                  className="btn-link text-danger"
                                  onClick={() => handleBanToggle(u)}
                                >
                                  {u.is_banned ? "Unban" : "Ban"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "14px",
            }}
          >
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
              Showing {Math.min(userOffset + 1, userTotal)}–
              {Math.min(userOffset + userLimit, userTotal)} of {userTotal}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={userOffset === 0}
                onClick={() =>
                  setUserOffset(Math.max(0, userOffset - userLimit))
                }
              >
                ← Previous
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={userOffset + userLimit >= userTotal}
                onClick={() => setUserOffset(userOffset + userLimit)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT MODERATION */}
      {activeTab === "content" && (
        <div className="panel-card" style={{ marginTop: "20px" }}>
          <div className="panel-header-row">
            <h3>📦 All Reports Moderation ({modItems.length})</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {selectedItemIds.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkDeleteItems}
                >
                  Bulk Delete ({selectedItemIds.length})
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  downloadAdminCsv("items", {
                    type: modType,
                    category: modCategory,
                    search: modSearch,
                  })
                }
              >
                ⬇ Export Reports CSV
              </button>
            </div>
          </div>

          <div className="filters-group" style={{ marginBottom: "14px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Filter reports by title or location..."
              value={modSearch}
              onChange={(e) => setModSearch(e.target.value)}
            />
            <select
              className="select-input"
              value={modType}
              onChange={(e) => setModType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="lost">Lost</option>
              <option value="found">Found</option>
            </select>
            <select
              className="select-input"
              value={modCategory}
              onChange={(e) => setModCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title &amp; Location</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {modItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedItemIds([...selectedItemIds, item.id])
                          else
                            setSelectedItemIds(
                              selectedItemIds.filter((id) => id !== item.id)
                            )
                        }}
                      />
                    </td>
                    <td>#{item.id}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>
                        {item.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <br />
                      <span className="text-muted">📍 {item.location}</span>
                    </td>
                    <td>{item.owner_name || "Campus Member"}</td>
                    <td>{item.status.toUpperCase()}</td>
                    <td>
                      <button
                        className="btn-link text-danger"
                        onClick={() => handleDeleteSingleItem(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: "28px" }}>
            🤝 Recovery Teams Moderation ({modGroups.length})
          </h3>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Group Name</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {modGroups.map((g) => (
                  <tr key={g.id}>
                    <td>#{g.id}</td>
                    <td>
                      <strong>{g.name}</strong>
                      <br />
                      <span className="text-muted">{g.description}</span>
                    </td>
                    <td>{g.owner_name}</td>
                    <td>{g.member_count}</td>
                    <td>
                      <button
                        className="btn-link text-danger"
                        onClick={() => handleDeleteGroupAdmin(g.id)}
                      >
                        Delete Group
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY AUDIT LOG */}
      {activeTab === "activity" && (
        <div className="panel-card" style={{ marginTop: "20px" }}>
          <div className="panel-header-row">
            <h3>📜 System Activity &amp; Audit Log ({activityLogs.length})</h3>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                downloadAdminCsv("activity", {
                  action: actAction,
                  search: actSearch,
                })
              }
            >
              ⬇ Export Activity CSV
            </button>
          </div>

          <div className="filters-group" style={{ marginBottom: "14px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search user email, IP address, or detail..."
              value={actSearch}
              onChange={(e) => setActSearch(e.target.value)}
            />
            <select
              className="select-input"
              value={actAction}
              onChange={(e) => setActAction(e.target.value)}
            >
              <option value="all">All Events</option>
              <option value="login">login</option>
              <option value="failed_login">failed_login</option>
              <option value="logout">logout</option>
              <option value="signup">signup</option>
              <option value="password_change">password_change</option>
              <option value="role_change">role_change</option>
              <option value="user_ban">user_ban</option>
              <option value="user_unban">user_unban</option>
              <option value="item_create">item_create</option>
              <option value="item_delete">item_delete</option>
              <option value="data_export">data_export</option>
              <option value="token_rejected">token_rejected</option>
              <option value="rbac_denied">rbac_denied</option>
            </select>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Detail</th>
                  <th>IP &amp; Browser</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                    <td>{a.user_email}</td>
                    <td>
                      <span className="role-tag role-member">{a.action}</span>
                    </td>
                    <td>{a.detail}</td>
                    <td>
                      <strong>{a.ip_address}</strong>
                      <br />
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.75rem" }}
                      >
                        {a.user_agent.slice(0, 55)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY MONITOR VIEW */}
      {activeTab === "security" && securityData && (
        <div className="panel-card" style={{ marginTop: "20px" }}>
          <h3>🚨 Security Monitoring (Failed Logins &amp; Denied Requests)</h3>
          <div className="profile-grid" style={{ marginTop: "16px" }}>
            <div className="detail-box">
              <h4>Failed Logins by IP Address</h4>
              {securityData.failed_by_ip.length === 0 ? (
                <p className="text-muted">No failed logins recorded.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityData.failed_by_ip.map((b) => (
                      <tr key={b.key}>
                        <td>{b.key}</td>
                        <td>
                          <strong>{b.count}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="detail-box">
              <h4>Failed Logins by Account</h4>
              {securityData.failed_by_account.length === 0 ? (
                <p className="text-muted">No failed logins recorded.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Account Email</th>
                      <th>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityData.failed_by_account.map((b) => (
                      <tr key={b.key}>
                        <td>{b.key}</td>
                        <td>
                          <strong>{b.count}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <h4 style={{ marginTop: "24px" }}>
            Recent Security Events (Rejected Tokens, RBAC Denials &amp; Failed
            Logins)
          </h4>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Account</th>
                  <th>Event</th>
                  <th>Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {securityData.recent_security_events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{new Date(ev.created_at).toLocaleString()}</td>
                    <td>{ev.user_email}</td>
                    <td>
                      <span className="badge badge-lost">{ev.action}</span>
                    </td>
                    <td>{ev.detail}</td>
                    <td>{ev.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER DETAIL DRAWER / MODAL */}
      {inspectingUser && (
        <div
          className="modal-backdrop"
          onClick={() => setInspectingUser(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: "680px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                👤 User Detail: {inspectingUser.user.name} (
                {inspectingUser.user.email})
              </h2>
              <button
                className="close-btn"
                onClick={() => setInspectingUser(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-badges">
                <span className={`role-tag role-${inspectingUser.user.role}`}>
                  Role: {inspectingUser.user.role.toUpperCase()}
                </span>
                <span className="badge badge-status badge-status-active">
                  Reports: {inspectingUser.items.length}
                </span>
                <span className="badge badge-status badge-status-active">
                  Groups: {inspectingUser.groups.length}
                </span>
                <span className="badge badge-status badge-status-active">
                  Active Sessions: {inspectingUser.sessions.length}
                </span>
              </div>

              {inspectingUser.sessions.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginBottom: "14px" }}
                  onClick={async () => {
                    await revokeUserSessionsAdmin(inspectingUser.user.id)
                    handleInspectUser(inspectingUser.user.id)
                  }}
                >
                  Revoke All {inspectingUser.sessions.length} Active Session(s)
                </button>
              )}

              <h4>Submitted Reports ({inspectingUser.items.length})</h4>
              <ul style={{ marginLeft: "18px", marginBottom: "14px" }}>
                {inspectingUser.items.map((i) => (
                  <li key={i.id}>
                    #{i.id} [{i.type.toUpperCase()}] {i.title} — {i.location}
                  </li>
                ))}
              </ul>

              <h4>Group Memberships ({inspectingUser.groups.length})</h4>
              <ul style={{ marginLeft: "18px", marginBottom: "14px" }}>
                {inspectingUser.groups.map((g) => (
                  <li key={g.id}>
                    {g.name} ({g.my_role})
                  </li>
                ))}
              </ul>

              <h4>
                Recent Activity ({inspectingUser.recent_activity.length})
              </h4>
              <ul style={{ marginLeft: "18px" }}>
                {inspectingUser.recent_activity.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <strong>{a.action}</strong>: {a.detail} (
                    {new Date(a.created_at).toLocaleString()})
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setInspectingUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
