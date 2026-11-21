import { useState } from "react"
import { loginUser } from "../api"
import type { AppPage, User } from "../types"

interface LoginPageProps {
  onSuccess: (user: User) => void
  onNavigate: (page: AppPage) => void
}

const DEMO_ACCOUNTS = [
  { label: "🛡️ Chief Admin", email: "admin@campus.edu", role: "admin" },
  { label: "🛡️ Desk Moderator", email: "moderator@campus.edu", role: "admin" },
  {
    label: "🎓 Sakif Ishmam (Group Owner)",
    email: "student@campus.edu",
    role: "user",
  },
  {
    label: "🎓 Ammar Rahman (Create/Edit/Assign)",
    email: "ammar@campus.edu",
    role: "user",
  },
  {
    label: "🎓 Sajid Ahmed (Create Only)",
    email: "sajid@campus.edu",
    role: "user",
  },
]

export default function LoginPage({ onSuccess, onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const res = await loginUser({ email: email.trim(), password })
      onSuccess(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🔐</div>
          <h2>Sign In to Campus Lost &amp; Found</h2>
          <p>
            Access your profile, manage your reports, collaborate in recovery
            teams, or administer the system
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Campus Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="e.g., student@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Log In"}
          </button>
        </form>

        <div className="demo-box">
          <span className="demo-label">
            ⚡ Select Instructor Demo Account (Prefills Email):
          </span>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEmail(acc.email)}
              >
                {acc.label} — {acc.email}
              </button>
            ))}
          </div>
        </div>

        <p className="auth-switch">
          Don&apos;t have an account yet?{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate("signup")}
          >
            Create a Campus Account
          </button>
        </p>
      </div>
    </div>
  )
}
