import type { ReactNode } from "react"
import LoginPage from "../pages/LoginPage"
import SignupPage from "../pages/SignupPage"
import type { AppPage, User } from "../types"

interface ProtectedRouteProps {
  currentUser: User | null
  authRestoring: boolean
  currentPage: AppPage
  requireAdmin?: boolean
  onLoginSuccess: (user: User) => void
  onNavigate: (page: AppPage) => void
  children: ReactNode
}

export default function ProtectedRoute({
  currentUser,
  authRestoring,
  currentPage,
  requireAdmin = false,
  onLoginSuccess,
  onNavigate,
  children,
}: ProtectedRouteProps) {
  if (authRestoring) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p>Restoring secure session...</p>
      </div>
    )
  }

  if (!currentUser) {
    if (currentPage === "signup") {
      return (
        <SignupPage onSuccess={onLoginSuccess} onNavigate={onNavigate} />
      )
    }
    return <LoginPage onSuccess={onLoginSuccess} onNavigate={onNavigate} />
  }

  if (requireAdmin && currentUser.role !== "admin") {
    return (
      <div className="alert alert-error">
        <strong>403 Forbidden:</strong> Administrator privileges are required to
        view this page.
      </div>
    )
  }

  return <>{children}</>
}
