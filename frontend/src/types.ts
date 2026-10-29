export type ItemType = "lost" | "found"
export type ItemStatus = "active" | "claimed" | "resolved"

export interface Item {
  id: number
  type: ItemType
  title: string
  category: string
  location: string
  description: string
  contact_info: string
  status: ItemStatus
  created_at: string
}

export interface ItemCreatePayload {
  type: ItemType
  title: string
  category: string
  location: string
  description: string
  contact_info: string
  status?: ItemStatus
}

export type ItemUpdatePayload = Partial<ItemCreatePayload>
