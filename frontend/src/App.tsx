import { useEffect, useState } from "react"
import {
  createItem,
  deleteItem,
  fetchItem,
  fetchItems,
  fetchProfile,
  getStoredToken,
  logoutUser,
  setOnAuthKicked,
  setStoredToken,
  tryRefreshSession,
  updateItem,
} from "./api"
import FilterBar from "./components/FilterBar"
import Header from "./components/Header"
import ItemDetailModal from "./components/ItemDetailModal"
import ItemList from "./components/ItemList"
import ProtectedRoute from "./components/ProtectedRoute"
import ReportModal from "./components/ReportModal"
import AdminPage from "./pages/AdminPage"
import GroupsPage from "./pages/GroupsPage"
import LoginPage from "./pages/LoginPage"
import ProfilePage from "./pages/ProfilePage"
import SignupPage from "./pages/SignupPage"
import type {
  AppPage,
  Item,
  ItemCreatePayload,
  ItemStatus,
  ItemType,
  ItemUpdatePayload,
  User,
} from "./types"

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>(
    getStoredToken() ? "board" : "login"
  )
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authRestoring, setAuthRestoring] = useState<boolean>(
    Boolean(getStoredToken())
  )
  const [authBanner, setAuthBanner] = useState<string>("")

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState<boolean>(false)
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

  // Check API health on startup
  useEffect(() => {
    fetch("/api/health")
      .then((r) => setServerOk(r.ok))
      .catch(() => setServerOk(false))
  }, [])

  // Register listener for automatic logout when banned or token rejected
  useEffect(() => {
    setOnAuthKicked((reason) => {
      setCurrentUser(null)
      setItems([])
      setCurrentPage("login")
      if (reason) setAuthBanner(reason)
    })
    return () => setOnAuthKicked(null)
  }, [])

  // Restore session without guest link flash
  useEffect(() => {
    async function restore() {
      if (!getStoredToken()) {
        setAuthRestoring(false)
        setCurrentPage("login")
        return
      }
      try {
        const user = await fetchProfile()
        setCurrentUser(user)
        setCurrentPage("board")
      } catch {
        const refreshed = await tryRefreshSession()
        if (refreshed) {
          setCurrentUser(refreshed.user)
          setCurrentPage("board")
        } else {
          setStoredToken(null)
          setCurrentUser(null)
          setCurrentPage("login")
        }
      } finally {
        setAuthRestoring(false)
      }
    }
    restore()
  }, [])

  async function loadItems() {
    if (!currentUser) {
      setItems([])
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await fetchItems({
        type: typeFilter,
        category:
          categoryFilter === "All Categories" ? undefined : categoryFilter,
        search: searchQuery,
      })
      setItems(data)
      setServerOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser) {
      loadItems()
    } else {
      setItems([])
    }
  }, [currentUser, typeFilter, categoryFilter, searchQuery])

  async function handleLogout() {
    await logoutUser()
    setCurrentUser(null)
    setItems([])
    setCurrentPage("login")
  }

  function handleLoginSuccess(user: User) {
    setAuthBanner("")
    setCurrentUser(user)
    setCurrentPage("board")
  }

  function handleOpenCreate(defaultType: ItemType = "lost") {
    if (!currentUser) {
      setCurrentPage("login")
      return
    }
    setFormData({
      type: defaultType,
      title: "",
      category: "Electronics",
      location: "",
      description: "",
      contact_info: currentUser.email,
      status: "active",
    })
    setFormError("")
    setIsCreateOpen(true)
  }

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
      setFormError(
        err instanceof Error ? err.message : "Failed to submit report"
      )
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleViewDetails(id: number) {
    try {
      const item = await fetchItem(id)
      setViewingItem(item)
    } catch (err) {
      alert(
        "Error loading item details: " +
          (err instanceof Error ? err.message : err)
      )
    }
  }

  function handleOpenEdit(item: Item) {
    setEditingItem({ ...item })
    setFormError("")
  }

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
      setFormError(
        err instanceof Error ? err.message : "Failed to update report"
      )
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleQuickStatus(item: Item, newStatus: ItemStatus) {
    try {
      await updateItem(item.id, { status: newStatus })
      if (viewingItem?.id === item.id) {
        setViewingItem({ ...viewingItem, status: newStatus })
      }
      loadItems()
    } catch (err) {
      alert(
        "Failed to update status: " + (err instanceof Error ? err.message : err)
      )
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }
    try {
      await deleteItem(id)
      if (viewingItem?.id === id) {
        setViewingItem(null)
      }
      loadItems()
    } catch (err) {
      alert(
        "Failed to delete report: " + (err instanceof Error ? err.message : err)
      )
    }
  }

  return (
    <div className="app-container">
      <Header
        currentPage={currentPage}
        onNavigate={(page) => {
          setAuthBanner("")
          setCurrentPage(page)
        }}
        currentUser={currentUser}
        authRestoring={authRestoring}
        onLogout={handleLogout}
        serverOk={serverOk}
        onOpenCreate={handleOpenCreate}
      />

      <main className="main-content">
        {authBanner && <div className="alert alert-error">{authBanner}</div>}

        {currentPage === "login" && !currentUser ? (
          <LoginPage
            onSuccess={handleLoginSuccess}
            onNavigate={setCurrentPage}
          />
        ) : currentPage === "signup" && !currentUser ? (
          <SignupPage
            onSuccess={handleLoginSuccess}
            onNavigate={setCurrentPage}
          />
        ) : (
          <ProtectedRoute
            currentUser={currentUser}
            authRestoring={authRestoring}
            currentPage={currentPage}
            requireAdmin={currentPage === "admin"}
            onLoginSuccess={handleLoginSuccess}
            onNavigate={setCurrentPage}
          >
            {currentPage === "groups" && currentUser && (
              <GroupsPage currentUser={currentUser} />
            )}

            {currentPage === "profile" && currentUser && (
              <ProfilePage
                user={currentUser}
                items={items}
                onUserUpdated={setCurrentUser}
                onLoggedOutEverywhere={() => {
                  setCurrentUser(null)
                  setItems([])
                  setCurrentPage("login")
                }}
                onViewDetails={handleViewDetails}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                onOpenCreate={handleOpenCreate}
              />
            )}

            {currentPage === "admin" && currentUser?.role === "admin" && (
              <AdminPage
                currentUser={currentUser}
                onItemsChanged={loadItems}
              />
            )}

            {(currentPage === "board" ||
              currentPage === "login" ||
              currentPage === "signup") &&
              currentUser && (
                <>
                  <FilterBar
                    totalCount={items.length}
                    typeFilter={typeFilter}
                    onTypeFilterChange={setTypeFilter}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onRefresh={loadItems}
                  />

                  {error && <div className="alert alert-error">{error}</div>}

                  <ItemList
                    items={items}
                    loading={loading}
                    currentUser={currentUser}
                    onViewDetails={handleViewDetails}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    onOpenCreate={handleOpenCreate}
                  />
                </>
              )}
          </ProtectedRoute>
        )}
      </main>

      {isCreateOpen && currentUser && (
        <ReportModal
          mode="create"
          formData={formData}
          onChange={setFormData}
          onSubmit={handleCreateSubmit}
          onClose={() => setIsCreateOpen(false)}
          submitting={formSubmitting}
          error={formError}
        />
      )}

      {viewingItem && currentUser && (
        <ItemDetailModal
          item={viewingItem}
          currentUser={currentUser}
          onClose={() => setViewingItem(null)}
          onQuickStatus={handleQuickStatus}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      )}

      {editingItem && currentUser && (
        <ReportModal
          mode="edit"
          itemId={editingItem.id}
          formData={{
            type: editingItem.type,
            title: editingItem.title,
            category: editingItem.category,
            location: editingItem.location,
            description: editingItem.description,
            contact_info: editingItem.contact_info,
            status: editingItem.status,
          }}
          onChange={(updated) =>
            setEditingItem({ ...editingItem, ...updated } as Item)
          }
          onSubmit={handleUpdateSubmit}
          onClose={() => setEditingItem(null)}
          submitting={formSubmitting}
          error={formError}
        />
      )}
    </div>
  )
}
