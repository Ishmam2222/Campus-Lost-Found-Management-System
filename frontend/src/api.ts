import type { Item, ItemCreatePayload, ItemUpdatePayload } from "./types"

const API_BASE = "/api"

export async function fetchItems(filter?: {
  type?: string
  category?: string
  search?: string
}): Promise<Item[]> {
  const params = new URLSearchParams()
  if (filter?.type && filter.type !== "all") params.append("type", filter.type)
  if (filter?.category && filter.category !== "all")
    params.append("category", filter.category)
  if (filter?.search) params.append("search", filter.search.trim())

  const url = `${API_BASE}/items${params.toString() ? `?${params.toString()}` : ""}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load items (${response.status})`)
  }
  return response.json()
}

export async function fetchItem(id: number): Promise<Item> {
  const response = await fetch(`${API_BASE}/items/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to load item #${id} (${response.status})`)
  }
  return response.json()
}

export async function createItem(data: ItemCreatePayload): Promise<Item> {
  const response = await fetch(`${API_BASE}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to create item (${response.status})`)
  }
  return response.json()
}

export async function updateItem(
  id: number,
  data: ItemUpdatePayload
): Promise<Item> {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `Failed to update item (${response.status})`)
  }
  return response.json()
}

export async function deleteItem(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(`Failed to delete item #${id} (${response.status})`)
  }
}
