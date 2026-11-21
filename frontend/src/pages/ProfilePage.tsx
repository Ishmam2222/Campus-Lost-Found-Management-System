import { useEffect, useState } from "react"
import {
  changePassword,
  fetchMySessions,
  revokeAllSessions,
  revokeMySession,
  revokeOtherSessions,
  updateProfile,
} from "../api"
import ItemCard from "../components/ItemCard"
import type { Item, ItemType, SessionInfo, User } from "../types"

interface ProfilePageProps {
  user: User
  items: Item[]
  onUserUpdated: (updated: User) => void
  onLoggedOutEverywhere: () => void
  onViewDetails: (id: number) => void
  onEdit: (item: Item) => void
  onDelete: (id: number, title: string) => void
  onOpenCreate: (defaultType: ItemType) => void
}

export default function ProfilePage({
  user,
  items,
  onUserUpdated,
  onLoggedOutEverywhere,
  onViewDetails,
  onEdit,
  onDelete,
  onOpenCreate,
}: ProfilePageProps) {
  const [name, setName] = useState(user.name)
  const [profileMsg, setProfileMsg] = useState("")
  const [profileErr, setProfileErr] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [pwMsg, setPwMsg] = useState("")
  const [pwErr, setPwErr] = useState("")
  const [savingPw, setSavingPw] = useState(false)

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const myItems = items.filter((item) => item.owner_id === user.id)

  async function loadSessions() {
    setLoadingSessions(true)
    try {
      const list = await fetchMySessions()
      setSessions(list)
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg("")
    setProfileErr("")
    setSavingProfile(true)
    try {
      const updated = await updateProfile(name.trim())
      onUserUpdated(updated)
      setProfileMsg("Display name updated successfully!")
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "Failed to update name")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg("")
    setPwErr("")
    if (newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters.")
      return
    }
    setSavingPw(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setPwMsg("Password changed! Existing refresh sessions were revoked.")
      loadSessions()
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setSavingPw(false)
    }
  }

  async function handleRevokeSession(sessionId: number) {
    try {
      await revokeMySession(sessionId)
      loadSessions()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke session")
    }
  }

  async function handleRevokeOthers() {
    try {
      await revokeOtherSessions()
      loadSessions()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke other sessions")
    }
  }

  async function handleRevokeAll() {
    if (!window.confirm("Log out of all devices including this browser?")) return
    await revokeAllSessions()
    onLoggedOutEverywhere()
  }

  return (
    <div className="dashboard-section">
      <div className="profile-grid">
        <div className="panel-card">
          <h3>👤 Account Profile</h3>
          <p className="panel-subtitle">
            Signed in as <strong>{user.email}</strong>
          </p>

          <div className="profile-badges">
            <span className={`role-tag role-${user.role}`}>
              Role: {user.role.toUpperCase()}
            </span>
            <span className="badge badge-status badge-status-active">
              Joined {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>

          {profileMsg && <div className="alert alert-success">{profileMsg}</div>}
          {profileErr && <div className="alert alert-error">{profileErr}</div>}

          <form onSubmit={handleUpdateName} className="panel-form">
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Profile Name"}
            </button>
          </form>
        </div>

        <div className="panel-card">
          <h3>🔑 Change Password</h3>
          <p className="panel-subtitle">
            Current password required; failed attempts are audited
          </p>

          {pwMsg && <div className="alert alert-success">{pwMsg}</div>}
          {pwErr && <div className="alert alert-error">{pwErr}</div>}

          <form onSubmit={handleChangePassword} className="panel-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={savingPw}
            >
              {savingPw ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Active Login Sessions Card */}
      <div className="panel-card" style={{ marginTop: "24px" }}>
        <div className="panel-header-row">
          <div>
            <h3>🖥️ Active Login Sessions ({sessions.length})</h3>
            <p className="panel-subtitle">
              Manage devices logged into your account via HttpOnly refresh tokens
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleRevokeOthers}
            >
              Revoke Other Devices
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleRevokeAll}>
              Log Out Everywhere
            </button>
          </div>
        </div>

        {loadingSessions ? (
          <p className="text-muted">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted">No active refresh sessions recorded.</p>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>IP Address</th>
                  <th>Browser / Device</th>
                  <th>Last Activity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      #{s.id}{" "}
                      {s.is_current && (
                        <span className="you-tag">(Current Device)</span>
                      )}
                    </td>
                    <td>{s.ip_address}</td>
                    <td>{s.user_agent}</td>
                    <td>{new Date(s.last_used_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn-link text-danger"
                        onClick={() => handleRevokeSession(s.id)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User's Own Reports */}
      <div className="panel-card" style={{ marginTop: "24px" }}>
        <div className="panel-header-row">
          <div>
            <h3>📋 My Submitted Reports ({myItems.length})</h3>
            <p className="panel-subtitle">
              Reports owned by your account ({user.email})
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => onOpenCreate("lost")}
          >
            + New Report
          </button>
        </div>

        {myItems.length === 0 ? (
          <p className="text-muted" style={{ padding: "16px 0" }}>
            You haven&apos;t submitted any reports under this account yet.
          </p>
        ) : (
          <div className="cards-grid" style={{ marginTop: "16px" }}>
            {myItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currentUser={user}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
