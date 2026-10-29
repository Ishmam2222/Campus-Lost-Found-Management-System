import { useEffect, useState } from "react"
import {
  createItem,
  deleteItem,
  fetchItem,
  fetchItems,
  updateItem,
} from "./api"
import type {
  Item,
  ItemCreatePayload,
  ItemStatus,
  ItemType,
  ItemUpdatePayload,
} from "./types"

const CATEGORIES = [
  "All Categories",
  "Electronics",
  "IDs & Cards",
  "Keys",
  "Bags & Wallets",
  "Books & Stationery",
  "Clothing",
  "Other",
]

export default function App() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [serverOk, setServerOk] = useState<boolean | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | ItemType>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [viewingItem, setViewingItem] = useState<Item | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  // Form State
  const [formData, setFormData] = useState<ItemCreatePayload>({
    type: "lost",
    title: "",
    category: "Electronics",
    location: "",
    description: "",
    contact_info: "",
    status: "active",
  })
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>("")

  // Load items
  async function loadItems() {
    setLoading(true)
    setError("")
    try {
      const data = await fetchItems({
        type: typeFilter,
        category: categoryFilter === "All Categories" ? undefined : categoryFilter,
        search: searchQuery,
      })
      setItems(data)
      setServerOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports")
      setServerOk(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [typeFilter, categoryFilter, searchQuery])

  // Open Create Modal
  function handleOpenCreate(defaultType: ItemType = "lost") {
    setFormData({
      type: defaultType,
      title: "",
      category: "Electronics",
      location: "",
      description: "",
      contact_info: "",
      status: "active",
    })
    setFormError("")
    setIsCreateOpen(true)
  }

  // Handle Create Submit
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim()) {
      setFormError("Title is required.")
      return
    }
    if (!formData.location.trim()) {
      setFormError("Location is required.")
      return
    }

    setFormSubmitting(true)
    setFormError("")
    try {
      await createItem(formData)
      setIsCreateOpen(false)
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit report")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Read Single (View Details)
  async function handleViewDetails(id: number) {
    try {
      const item = await fetchItem(id)
      setViewingItem(item)
    } catch (err) {
      alert("Error loading item details: " + (err instanceof Error ? err.message : err))
    }
  }

  // Open Edit Modal
  function handleOpenEdit(item: Item) {
    setEditingItem({ ...item })
    setFormError("")
  }

  // Handle Edit Submit (Update)
  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return

    setFormSubmitting(true)
    setFormError("")
    try {
      const payload: ItemUpdatePayload = {
        title: editingItem.title,
        type: editingItem.type,
        category: editingItem.category,
        location: editingItem.location,
        description: editingItem.description,
        contact_info: editingItem.contact_info,
        status: editingItem.status,
      }
      await updateItem(editingItem.id, payload)
      setEditingItem(null)
      if (viewingItem?.id === editingItem.id) {
        setViewingItem({ ...viewingItem, ...payload } as Item)
      }
      loadItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update report")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Quick Status Change
  async function handleQuickStatus(item: Item, newStatus: ItemStatus) {
    try {
      await updateItem(item.id, { status: newStatus })
      if (viewingItem?.id === item.id) {
        setViewingItem({ ...viewingItem, status: newStatus })
      }
      loadItems()
    } catch (err) {
      alert("Failed to update status: " + (err instanceof Error ? err.message : err))
    }
  }

  // Handle Delete
  async function handleDelete(id: number, title: string) {
    if (!confirm(`Are you sure you want to delete report "${title}"?`)) return
    try {
      await deleteItem(id)
      if (viewingItem?.id === id) setViewingItem(null)
      loadItems()
    } catch (err) {
      alert("Failed to delete report: " + (err instanceof Error ? err.message : err))
    }
  }

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="header">
        <div className="header-brand">
          <span className="brand-logo">🔍</span>
          <div>
            <h1>Campus Lost &amp; Found</h1>
            <p className="subtitle">Reconnect campus members with lost belongings</p>
          </div>
        </div>

        <div className="header-actions">
          <span className={`status-pill ${serverOk ? "online" : serverOk === false ? "offline" : ""}`}>
            {serverOk ? "API Connected" : serverOk === false ? "API Disconnected" : "Checking..."}
          </span>
          <button className="btn btn-primary" onClick={() => handleOpenCreate("lost")}>
            + Report Lost Item
          </button>
          <button className="btn btn-secondary" onClick={() => handleOpenCreate("found")}>
            + Report Found Item
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Filter and Search Bar */}
        <div className="controls-card">
          <div className="tabs">
            <button
              className={`tab-btn ${typeFilter === "all" ? "active" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              All Reports ({items.length})
            </button>
            <button
              className={`tab-btn ${typeFilter === "lost" ? "active" : ""}`}
              onClick={() => setTypeFilter("lost")}
            >
              🔴 Lost Items
            </button>
            <button
              className={`tab-btn ${typeFilter === "found" ? "active" : ""}`}
              onClick={() => setTypeFilter("found")}
            >
              🟢 Found Items
            </button>
          </div>

          <div className="filters-group">
            <input
              type="text"
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-banner">
            ⚠️ {error} — Make sure the FastAPI backend is running!
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Loading reports from server...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">📭</p>
            <h3>No reports found</h3>
            <p>Be the first to report a lost or found item on campus!</p>
            <button className="btn btn-primary" onClick={() => handleOpenCreate("lost")}>
              Create a Report
            </button>
          </div>
        ) : (
          /* Cards Grid (Read List) */
          <div className="grid">
            {items.map((item) => (
              <div key={item.id} className={`card ${item.type}`}>
                <div className="card-header">
                  <span className={`badge badge-${item.type}`}>
                    {item.type.toUpperCase()}
                  </span>
                  <span className={`badge badge-status badge-status-${item.status}`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="card-title" onClick={() => handleViewDetails(item.id)}>
                  {item.title}
                </h3>

                <p className="card-meta">
                  <span>📍 {item.location}</span> &bull; <span>🏷️ {item.category}</span>
                </p>

                {item.description && (
                  <p className="card-desc">
                    {item.description.length > 90
                      ? item.description.substring(0, 90) + "..."
                      : item.description}
                  </p>
                )}

                <div className="card-footer">
                  <span className="card-date">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>

                  <div className="card-buttons">
                    <button
                      className="btn-link"
                      onClick={() => handleViewDetails(item.id)}
                    >
                      View
                    </button>
                    <button
                      className="btn-link"
                      onClick={() => handleOpenEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-link text-danger"
                      onClick={() => handleDelete(item.id, item.title)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Report an Item</h2>
              <button className="close-btn" onClick={() => setIsCreateOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              {formError && <div className="form-error">⚠️ {formError}</div>}

              <div className="form-group">
                <label>Report Type</label>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${formData.type === "lost" ? "active-lost" : ""}`}
                    onClick={() => setFormData({ ...formData, type: "lost" })}
                  >
                    Lost Item
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${formData.type === "found" ? "active-found" : ""}`}
                    onClick={() => setFormData({ ...formData, type: "found" })}
                  >
                    Found Item
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Item Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Black Dell Laptop or Blue Water Bottle"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Building 2nd Floor"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description &amp; Key Features</label>
                <textarea
                  rows={3}
                  placeholder="Include color, stickers, brand, unique marks..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Your Contact Info</label>
                <input
                  type="text"
                  placeholder="Email, phone number, or student ID"
                  value={formData.contact_info}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_info: e.target.value })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL (Read Single) */}
      {viewingItem && (
        <div className="modal-overlay" onClick={() => setViewingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className={`badge badge-${viewingItem.type}`}>
                  {viewingItem.type.toUpperCase()}
                </span>
                <span className={`badge badge-status badge-status-${viewingItem.status}`}>
                  {viewingItem.status.toUpperCase()}
                </span>
              </div>
              <button className="close-btn" onClick={() => setViewingItem(null)}>
                ✕
              </button>
            </div>

            <h2 style={{ marginTop: "12px", marginBottom: "8px" }}>
              {viewingItem.title}
            </h2>

            <div className="details-list">
              <div className="detail-item">
                <span className="detail-label">Report ID</span>
                <span>#{viewingItem.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Category</span>
                <span>{viewingItem.category}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Location</span>
                <span>{viewingItem.location}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Reported On</span>
                <span>{new Date(viewingItem.created_at).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Contact</span>
                <span>{viewingItem.contact_info || "Not provided"}</span>
              </div>
            </div>

            {viewingItem.description && (
              <div style={{ marginTop: "16px" }}>
                <h4 style={{ marginBottom: "6px" }}>Description</h4>
                <p style={{ background: "var(--card-bg-subtle)", padding: "12px", borderRadius: "6px" }}>
                  {viewingItem.description}
                </p>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              {viewingItem.status === "active" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleQuickStatus(viewingItem, "claimed")}
                >
                  Mark as Claimed / Resolved
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleQuickStatus(viewingItem, "active")}
                >
                  Re-open as Active
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const itm = viewingItem
                  setViewingItem(null)
                  handleOpenEdit(itm)
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL (Update) */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Report #{editingItem.id}</h2>
              <button className="close-btn" onClick={() => setEditingItem(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              {formError && <div className="form-error">⚠️ {formError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={editingItem.type}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        type: e.target.value as ItemType,
                      })
                    }
                  >
                    <option value="lost">Lost</option>
                    <option value="found">Found</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        status: e.target.value as ItemStatus,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="claimed">Claimed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Item Title *</label>
                <input
                  type="text"
                  required
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, title: e.target.value })
                  }
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, category: e.target.value })
                    }
                  >
                    {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    value={editingItem.location}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, location: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Contact Info</label>
                <input
                  type="text"
                  value={editingItem.contact_info}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      contact_info: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
