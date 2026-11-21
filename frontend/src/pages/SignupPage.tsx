import { useState } from "react"
import { registerUser } from "../api"
import type { AppPage, User } from "../types"

interface SignupPageProps {
  onSuccess: (user: User) => void
  onNavigate: (page: AppPage) => void
}

export default function SignupPage({ onSuccess, onNavigate }: SignupPageProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const res = await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
      })
      onSuccess(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">✨</div>
          <h2>Create a Campus Member Account</h2>
          <p>
            Register to post lost or found items and manage your reports in one
            place
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="signup-name">Full Name *</label>
            <input
              id="signup-name"
              type="text"
              placeholder="e.g., Sakif Ishmam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Campus Email Address *</label>
            <input
              id="signup-email"
              type="email"
              placeholder="e.g., 2220681@iub.edu.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="signup-password">Password (min 6 chars) *</label>
              <input
                id="signup-password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password *</label>
              <input
                id="signup-confirm"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Sign Up as Member"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate("login")}
          >
            Log In Here
          </button>
        </p>
      </div>
    </div>
  )
}
