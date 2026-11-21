import type { ItemCreatePayload, ItemStatus, ItemType } from "../types"
import { CATEGORIES } from "./FilterBar"

interface ReportModalProps {
  mode: "create" | "edit"
  itemId?: number
  formData: ItemCreatePayload
  onChange: (updated: ItemCreatePayload) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  submitting: boolean
  error: string
}

export default function ReportModal({
  mode,
  itemId,
  formData,
  onChange,
  onSubmit,
  onClose,
  submitting,
  error,
}: ReportModalProps) {
  const isEdit = mode === "edit"

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isEdit
              ? `Edit Report #${itemId}`
              : formData.type === "lost"
              ? "🔴 Report a Lost Item"
              : "🟢 Report a Found Item"}
          </h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Report Type *</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  onChange({ ...formData, type: e.target.value as ItemType })
                }
              >
                <option value="lost">Lost Item</option>
                <option value="found">Found Item</option>
              </select>
            </div>

            {isEdit ? (
              <div className="form-group">
                <label>Status *</label>
                <select
                  value={formData.status || "active"}
                  onChange={(e) =>
                    onChange({
                      ...formData,
                      status: e.target.value as ItemStatus,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="claimed">Claimed</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    onChange({ ...formData, category: e.target.value })
                  }
                >
                  {CATEGORIES.filter((c) => c !== "All Categories").map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Item Title *</label>
            <input
              type="text"
              placeholder="e.g., Blue Jansport Backpack, Black AirPods Pro"
              value={formData.title}
              onChange={(e) =>
                onChange({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          {isEdit ? (
            <div className="form-row">
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    onChange({ ...formData, category: e.target.value })
                  }
                >
                  {CATEGORIES.filter((c) => c !== "All Categories").map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Location *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    onChange({ ...formData, location: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Location (Where was it {formData.type}?) *</label>
              <input
                type="text"
                placeholder="e.g., Library 3rd Floor, Cafeteria Table 4"
                value={formData.location}
                onChange={(e) =>
                  onChange({ ...formData, location: e.target.value })
                }
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Add distinguishing details, brand, color, or stickers..."
              value={formData.description}
              onChange={(e) =>
                onChange({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label>Contact Info</label>
            <input
              type="text"
              placeholder="e.g., student@iub.edu.bd or 017XXXXXXXX"
              value={formData.contact_info}
              onChange={(e) =>
                onChange({ ...formData, contact_info: e.target.value })
              }
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
