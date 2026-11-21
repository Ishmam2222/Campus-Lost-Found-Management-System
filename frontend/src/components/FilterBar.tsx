import type { ItemType } from "../types"

export const CATEGORIES = [
  "All Categories",
  "Electronics",
  "IDs & Cards",
  "Keys",
  "Bags & Wallets",
  "Books & Stationery",
  "Clothing",
  "Other",
]

interface FilterBarProps {
  totalCount: number
  typeFilter: "all" | ItemType
  onTypeFilterChange: (type: "all" | ItemType) => void
  categoryFilter: string
  onCategoryFilterChange: (cat: string) => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onRefresh: () => void
}

export default function FilterBar({
  totalCount,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchQueryChange,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="controls-card">
      <div className="tabs">
        <button
          className={`tab-btn ${typeFilter === "all" ? "active" : ""}`}
          onClick={() => onTypeFilterChange("all")}
        >
          All Reports ({totalCount})
        </button>
        <button
          className={`tab-btn ${typeFilter === "lost" ? "active" : ""}`}
          onClick={() => onTypeFilterChange("lost")}
        >
          🔴 Lost Items
        </button>
        <button
          className={`tab-btn ${typeFilter === "found" ? "active" : ""}`}
          onClick={() => onTypeFilterChange("found")}
        >
          🟢 Found Items
        </button>
      </div>

      <div className="filters-group">
        <input
          type="text"
          placeholder="Search by title or description..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="select-input"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button
          className="btn btn-outline"
          onClick={onRefresh}
          title="Refresh list"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}
