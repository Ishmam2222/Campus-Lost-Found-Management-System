import type { AppPage, ItemType, User } from "../types"

interface HeaderProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  currentUser: User | null
  authRestoring: boolean
  onLogout: () => void
  serverOk: boolean | null
  onOpenCreate: (defaultType: ItemType) => void
}

export default function Header({
  currentPage,
  onNavigate,
  currentUser,
  authRestoring,
  onLogout,
  serverOk,
  onOpenCreate,
}: HeaderProps) {
  return (
    <header className="header">
      <div
        className="header-brand"
        style={{ cursor: "pointer" }}
        onClick={() => onNavigate(currentUser ? "board" : "login")}
      >
        <div className="brand-logo" aria-hidden="true">
          🎓
        </div>
        <div>
          <h1>Campus Lost &amp; Found</h1>
          <p className="subtitle">
            Secure Campus Belongings Recovery &amp; Team Desks
          </p>
        </div>
      </div>

      <nav className="nav-links" aria-label="Main navigation">
        {authRestoring ? (
          <span className="nav-btn text-muted">Restoring session...</span>
        ) : currentUser ? (
          <>
            <button
              className={`nav-btn ${currentPage === "board" ? "active" : ""}`}
              onClick={() => onNavigate("board")}
            >
              📋 My Reports
            </button>
            <button
              className={`nav-btn ${currentPage === "groups" ? "active" : ""}`}
              onClick={() => onNavigate("groups")}
            >
              🤝 Recovery Teams
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => onNavigate("profile")}
            >
              👤 {currentUser.name}
              <span className={`role-tag role-${currentUser.role}`}>
                {currentUser.role.toUpperCase()}
              </span>
            </button>
            {currentUser.role === "admin" && (
              <button
                className={`nav-btn ${currentPage === "admin" ? "active" : ""}`}
                onClick={() => onNavigate("admin")}
              >
                🛡️ Admin Panel
              </button>
            )}
            <button className="nav-btn nav-btn-logout" onClick={onLogout}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <button
              className={`nav-btn ${
                currentPage === "login" || currentPage === "board"
                  ? "active"
                  : ""
              }`}
              onClick={() => onNavigate("login")}
            >
              🔐 Log In
            </button>
            <button
              className={`nav-btn ${currentPage === "signup" ? "active" : ""}`}
              onClick={() => onNavigate("signup")}
            >
              ✨ Sign Up
            </button>
          </>
        )}
      </nav>

      <div className="header-actions">
        <span
          className={`status-pill ${
            serverOk ? "online" : serverOk === false ? "offline" : ""
          }`}
        >
          {serverOk
            ? "API Connected"
            : serverOk === false
            ? "API Disconnected"
            : "Checking..."}
        </span>
        {currentUser && (
          <>
            <button
              className="btn btn-primary"
              onClick={() => onOpenCreate("lost")}
            >
              + Report Lost
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onOpenCreate("found")}
            >
              + Report Found
            </button>
          </>
        )}
      </div>
    </header>
  )
}
