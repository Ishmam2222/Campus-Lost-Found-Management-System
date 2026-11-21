import type { Item, User } from "../types"

interface ItemCardProps {
  item: Item
  currentUser: User | null
  onViewDetails: (id: number) => void
  onEdit: (item: Item) => void
  onDelete: (id: number, title: string) => void
}

export function canModifyItem(item: Item, currentUser: User | null): boolean {
  if (!item.owner_id) return true
  if (!currentUser) return false
  return currentUser.role === "admin" || currentUser.id === item.owner_id
}

export default function ItemCard({
  item,
  currentUser,
  onViewDetails,
  onEdit,
  onDelete,
}: ItemCardProps) {
  const canModify = canModifyItem(item, currentUser)

  return (
    <div className={`card ${item.type}`}>
      <div className="card-header">
        <span className={`badge badge-${item.type}`}>
          {item.type.toUpperCase()}
        </span>
        <span className={`badge badge-status badge-status-${item.status}`}>
          {item.status.toUpperCase()}
        </span>
      </div>

      <h3 className="card-title" onClick={() => onViewDetails(item.id)}>
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
          👤 {item.owner_name || "Campus Member"} &bull;{" "}
          {new Date(item.created_at).toLocaleDateString()}
        </span>

        <div className="card-buttons">
          <button
            className="btn-link"
            onClick={() => onViewDetails(item.id)}
          >
            View
          </button>
          {canModify && (
            <>
              <button className="btn-link" onClick={() => onEdit(item)}>
                Edit
              </button>
              <button
                className="btn-link text-danger"
                onClick={() => onDelete(item.id, item.title)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
