import type { Item, ItemType, User } from "../types"
import ItemCard from "./ItemCard"

interface ItemListProps {
  items: Item[]
  loading: boolean
  currentUser: User | null
  onViewDetails: (id: number) => void
  onEdit: (item: Item) => void
  onDelete: (id: number, title: string) => void
  onOpenCreate: (defaultType: ItemType) => void
}

export default function ItemList({
  items,
  loading,
  currentUser,
  onViewDetails,
  onEdit,
  onDelete,
  onOpenCreate,
}: ItemListProps) {
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p>Loading campus reports...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-icon">🔍</p>
        <h3>No reports found</h3>
        <p>
          Try adjusting your filters or submit a new lost or found report.
        </p>
        <div className="empty-actions">
          <button
            className="btn btn-primary"
            onClick={() => onOpenCreate("lost")}
          >
            + Report Lost Item
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cards-grid">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          currentUser={currentUser}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
