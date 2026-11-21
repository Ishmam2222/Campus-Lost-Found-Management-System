import type { Item, ItemStatus, User } from "../types"
import { canModifyItem } from "./ItemCard"

interface ItemDetailModalProps {
  item: Item
  currentUser: User | null
  onClose: () => void
  onQuickStatus: (item: Item, newStatus: ItemStatus) => void
  onEdit: (item: Item) => void
  onDelete: (id: number, title: string) => void
}

export default function ItemDetailModal({
  item,
  currentUser,
  onClose,
  onQuickStatus,
  onEdit,
  onDelete,
}: ItemDetailModalProps) {
  const canModify = canModifyItem(item, currentUser)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="detail-badges">
            <span className={`badge badge-${item.type}`}>
              {item.type.toUpperCase()}
            </span>
            <span className={`badge badge-status badge-status-${item.status}`}>
              {item.status.toUpperCase()}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <h2 className="detail-title">{item.title}</h2>
          <p className="detail-id">
            Report ID: #{item.id} &bull; Reported by{" "}
            <strong>{item.owner_name || "Campus Member"}</strong> on{" "}
            {new Date(item.created_at).toLocaleString()}
          </p>

          <div className="detail-grid">
            <div className="detail-box">
              <span className="detail-label">📍 Location</span>
              <p>{item.location}</p>
            </div>
            <div className="detail-box">
              <span className="detail-label">🏷️ Category</span>
              <p>{item.category}</p>
            </div>
            <div className="detail-box full-width">
              <span className="detail-label">📝 Description</span>
              <p>{item.description || "No additional description provided."}</p>
            </div>
            <div className="detail-box full-width">
              <span className="detail-label">📞 Contact Information</span>
              <p>{item.contact_info || "No contact info provided."}</p>
            </div>
          </div>

          {canModify && (
            <div className="status-actions">
              <span className="detail-label">Quick Status Update:</span>
              <div className="status-buttons">
                {item.status !== "active" && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => onQuickStatus(item, "active")}
                  >
                    Mark Active
                  </button>
                )}
                {item.status !== "claimed" && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => onQuickStatus(item, "claimed")}
                  >
                    ✓ Mark as Claimed
                  </button>
                )}
                {item.status !== "resolved" && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onQuickStatus(item, "resolved")}
                  >
                    ★ Mark Resolved
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {canModify && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => {
                  onClose()
                  onEdit(item)
                }}
              >
                Edit Report
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDelete(item.id, item.title)}
              >
                Delete
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
