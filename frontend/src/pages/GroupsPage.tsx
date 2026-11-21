import { useEffect, useState } from "react"
import {
  addGroupMember,
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  fetchGroupItems,
  fetchGroupMembers,
  fetchGroups,
  removeGroupMember,
  updateGroup,
  updateGroupMemberPermissions,
  updateItem,
} from "../api"
import { CATEGORIES } from "../components/FilterBar"
import type {
  Group,
  GroupMember,
  Item,
  ItemStatus,
  ItemType,
  User,
} from "../types"

interface GroupsPageProps {
  currentUser: User
}

export default function GroupsPage({ currentUser }: GroupsPageProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [groupItems, setGroupItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // New group form
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDesc, setNewGroupDesc] = useState("")

  // Rename group
  const [renameText, setRenameText] = useState("")

  // Add member form
  const [memberEmail, setMemberEmail] = useState("")
  const [permCreate, setPermCreate] = useState(true)
  const [permEdit, setPermEdit] = useState(false)
  const [permAssign, setPermAssign] = useState(false)

  // Group item creation form
  const [itemType, setItemType] = useState<ItemType>("found")
  const [itemTitle, setItemTitle] = useState("")
  const [itemCategory, setItemCategory] = useState("Electronics")
  const [itemLocation, setItemLocation] = useState("")
  const [itemDesc, setItemDesc] = useState("")
  const [itemAssigneeId, setItemAssigneeId] = useState<number | "">("")

  async function loadGroups() {
    setLoading(true)
    setError("")
    try {
      const list = await fetchGroups()
      setGroups(list)
      if (list.length > 0 && !selectedGroup) {
        selectGroup(list[0])
      } else if (selectedGroup) {
        const refreshed = list.find((g) => g.id === selectedGroup.id)
        if (refreshed) selectGroup(refreshed)
        else setSelectedGroup(list[0] || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups")
    } finally {
      setLoading(false)
    }
  }

  async function selectGroup(g: Group) {
    setSelectedGroup(g)
    setRenameText(g.name)
    try {
      const [mList, iList] = await Promise.all([
        fetchGroupMembers(g.id),
        fetchGroupItems(g.id),
      ])
      setMembers(mList)
      setGroupItems(iList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group details")
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const myMember = members.find((m) => m.user_id === currentUser.id)
  const isOwner =
    myMember?.group_role === "owner" ||
    selectedGroup?.owner_id === currentUser.id ||
    currentUser.role === "admin"
  const canCreate = isOwner || Boolean(myMember?.can_create)
  const canEdit = isOwner || Boolean(myMember?.can_edit)
  const canAssign = isOwner || Boolean(myMember?.can_assign)

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    try {
      const created = await createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
      })
      setNewGroupName("")
      setNewGroupDesc("")
      await loadGroups()
      selectGroup(created)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create group")
    }
  }

  async function handleRenameGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !renameText.trim()) return
    try {
      const updated = await updateGroup(selectedGroup.id, {
        name: renameText.trim(),
      })
      setSelectedGroup(updated)
      loadGroups()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename group")
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return
    if (
      !window.confirm(
        `Delete recovery group "${selectedGroup.name}" and all its items?`
      )
    )
      return
    try {
      await deleteGroup(selectedGroup.id)
      setSelectedGroup(null)
      loadGroups()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete group")
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !memberEmail.trim()) return
    try {
      await addGroupMember(selectedGroup.id, {
        email: memberEmail.trim(),
        can_create: permCreate,
        can_edit: permEdit,
        can_assign: permAssign,
      })
      setMemberEmail("")
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add member")
    }
  }

  async function handleTogglePermission(
    m: GroupMember,
    field: "can_create" | "can_edit" | "can_assign"
  ) {
    if (!selectedGroup) return
    try {
      await updateGroupMemberPermissions(selectedGroup.id, m.user_id, {
        [field]: !m[field],
      })
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update permission")
    }
  }

  async function handleRemoveMember(m: GroupMember) {
    if (!selectedGroup) return
    try {
      await removeGroupMember(selectedGroup.id, m.user_id)
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member")
    }
  }

  async function handleCreateGroupItem(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup || !itemTitle.trim() || !itemLocation.trim()) return
    try {
      await createItem({
        type: itemType,
        title: itemTitle.trim(),
        category: itemCategory,
        location: itemLocation.trim(),
        description: itemDesc.trim(),
        contact_info: currentUser.email,
        group_id: selectedGroup.id,
        assignee_id: itemAssigneeId === "" ? null : Number(itemAssigneeId),
      })
      setItemTitle("")
      setItemLocation("")
      setItemDesc("")
      setItemAssigneeId("")
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create group report")
    }
  }

  async function handleGroupItemStatus(item: Item, status: ItemStatus) {
    if (!selectedGroup) return
    try {
      await updateItem(item.id, { status })
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Permission denied")
    }
  }

  async function handleGroupItemAssign(item: Item, assigneeId: string) {
    if (!selectedGroup) return
    try {
      await updateItem(item.id, {
        assignee_id: assigneeId === "" ? null : Number(assigneeId),
      })
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Assign permission denied")
    }
  }

  async function handleDeleteGroupItem(item: Item) {
    if (!selectedGroup) return
    try {
      await deleteItem(item.id)
      selectGroup(selectedGroup)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Only group owner can delete")
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p>Loading shared recovery teams...</p>
      </div>
    )
  }

  return (
    <div className="dashboard-section">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="profile-grid">
        {/* Left column: Groups List & Create Group */}
        <div className="panel-card">
          <h3>🤝 My Recovery Teams ({groups.length})</h3>
          <p className="panel-subtitle">
            Collaborate with department desks and volunteers with fine-grained
            permissions
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            {groups.map((g) => (
              <div
                key={g.id}
                onClick={() => selectGroup(g)}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border:
                    selectedGroup?.id === g.id
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border-color)",
                  background:
                    selectedGroup?.id === g.id
                      ? "#ecfdf5"
                      : "var(--card-bg-subtle)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>{g.name}</strong>
                  <span className="role-tag role-member">
                    {g.owner_id === currentUser.id ? "OWNER" : "MEMBER"}
                  </span>
                </div>
                <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                  {g.description || "Shared campus recovery desk"} &bull;{" "}
                  {g.member_count} member(s)
                </p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateGroup}
            className="panel-form"
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <h4>+ Create New Recovery Team</h4>
            <div className="form-group">
              <label>Team / Desk Name *</label>
              <input
                type="text"
                placeholder="e.g., CSE Building Lost & Found Desk"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                placeholder="Team responsibilities and desk hours"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create Team (You become Owner)
            </button>
          </form>
        </div>

        {/* Right column: Selected Group Details & Member Permissions */}
        {selectedGroup && (
          <div className="panel-card">
            <div className="panel-header-row">
              <div>
                <h3>🏛️ {selectedGroup.name}</h3>
                <p className="panel-subtitle">
                  Owner: <strong>{selectedGroup.owner_name}</strong> &bull; Your
                  Permissions:{" "}
                  {isOwner
                    ? "Full Owner (Create, Edit, Assign, Delete, Manage Members)"
                    : [
                        canCreate && "Create",
                        canEdit && "Edit",
                        canAssign && "Assign",
                      ]
                        .filter(Boolean)
                        .join(", ") || "Read-Only"}
                </p>
              </div>
              {isOwner && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteGroup}
                >
                  Delete Team
                </button>
              )}
            </div>

            {isOwner && (
              <form
                onSubmit={handleRenameGroup}
                style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
              >
                <input
                  type="text"
                  className="search-input"
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  placeholder="Rename group..."
                />
                <button type="submit" className="btn btn-outline btn-sm">
                  Rename
                </button>
              </form>
            )}

            <h4>👥 Team Members &amp; Granular Permissions ({members.length})</h4>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Create</th>
                    <th>Edit</th>
                    <th>Assign</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const memberIsOwner = m.group_role === "owner"
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.user_name}</strong>
                          <br />
                          <span className="text-muted">{m.user_email}</span>
                        </td>
                        <td>
                          <span
                            className={`role-tag ${
                              memberIsOwner ? "role-admin" : "role-member"
                            }`}
                          >
                            {m.group_role.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={memberIsOwner || m.can_create}
                            disabled={!isOwner || memberIsOwner}
                            onChange={() =>
                              handleTogglePermission(m, "can_create")
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={memberIsOwner || m.can_edit}
                            disabled={!isOwner || memberIsOwner}
                            onChange={() =>
                              handleTogglePermission(m, "can_edit")
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={memberIsOwner || m.can_assign}
                            disabled={!isOwner || memberIsOwner}
                            onChange={() =>
                              handleTogglePermission(m, "can_assign")
                            }
                          />
                        </td>
                        <td>
                          {!memberIsOwner &&
                            (isOwner || m.user_id === currentUser.id) && (
                              <button
                                className="btn-link text-danger"
                                onClick={() => handleRemoveMember(m)}
                              >
                                {m.user_id === currentUser.id
                                  ? "Leave"
                                  : "Remove"}
                              </button>
                            )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {isOwner && (
              <form
                onSubmit={handleAddMember}
                className="panel-form"
                style={{
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <h4>+ Add Member by Campus Email (Owner Only)</h4>
                <div className="form-row">
                  <input
                    type="email"
                    className="search-input"
                    placeholder="e.g., ammar@campus.edu"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-secondary">
                    Add Member
                  </button>
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "0.9rem" }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={permCreate}
                      onChange={(e) => setPermCreate(e.target.checked)}
                    />{" "}
                    Can Create
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permEdit}
                      onChange={(e) => setPermEdit(e.target.checked)}
                    />{" "}
                    Can Edit
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permAssign}
                      onChange={(e) => setPermAssign(e.target.checked)}
                    />{" "}
                    Can Assign
                  </label>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Group Shared Reports Section */}
      {selectedGroup && (
        <div className="panel-card" style={{ marginTop: "24px" }}>
          <h3>
            📦 Shared Reports in &ldquo;{selectedGroup.name}&rdquo; (
            {groupItems.length})
          </h3>
          <p className="panel-subtitle">
            Only members with <strong>Create</strong> can post,{" "}
            <strong>Edit</strong> can update status, <strong>Assign</strong> can
            assign a handler, and only the <strong>Owner</strong> can delete.
          </p>

          {canCreate && (
            <form
              onSubmit={handleCreateGroupItem}
              className="panel-form"
              style={{
                background: "var(--card-bg-subtle)",
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >
              <h4>+ Log Report to this Recovery Desk</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItemType)}
                  >
                    <option value="found">Found Item</option>
                    <option value="lost">Lost Item</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Silver Dell Laptop Charger"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c !== "All Categories").map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    placeholder="e.g., Library Desk 2"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input
                    type="text"
                    placeholder="Verification details"
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                  />
                </div>
                {canAssign && (
                  <div className="form-group">
                    <label>Assign Handler</label>
                    <select
                      value={itemAssigneeId}
                      onChange={(e) =>
                        setItemAssigneeId(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_name} ({m.user_email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary">
                Add Shared Group Report
              </button>
            </form>
          )}

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title &amp; Location</th>
                  <th>Status</th>
                  <th>Assigned Volunteer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item) => (
                  <tr key={item.id}>
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
                    <td>
                      {canEdit ? (
                        <select
                          className="select-input"
                          value={item.status}
                          onChange={(e) =>
                            handleGroupItemStatus(
                              item,
                              e.target.value as ItemStatus
                            )
                          }
                        >
                          <option value="active">Active</option>
                          <option value="claimed">Claimed</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      ) : (
                        <span
                          className={`badge badge-status badge-status-${item.status}`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td>
                      {canAssign ? (
                        <select
                          className="select-input"
                          value={item.assignee_id || ""}
                          onChange={(e) =>
                            handleGroupItemAssign(item, e.target.value)
                          }
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.user_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{item.assignee_name || "Unassigned"}</span>
                      )}
                    </td>
                    <td>
                      {isOwner ? (
                        <button
                          className="btn-link text-danger"
                          onClick={() => handleDeleteGroupItem(item)}
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-muted">Owner Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
