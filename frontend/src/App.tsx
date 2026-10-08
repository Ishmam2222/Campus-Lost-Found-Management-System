import { type FormEvent, useState } from "react"

export default function App() {
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsLoading(true)

    try {
      const params = new URLSearchParams({ name: name.trim() || "World" })
      const response = await fetch(`/api/hello?${params}`)
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }

      const data: { message: string } = await response.json()
      setMessage(data.message)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to the server.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main>
      <p className="eyebrow">CAMPUS COMMUNITY</p>
      <h1>Campus Lost &amp; Found</h1>
      <p className="intro">
        A home for reconnecting campus members with the things they have lost.
      </p>

      <section aria-labelledby="connection-title">
        <h2 id="connection-title">Your project is ready</h2>
        <p>
          This starter page is connected to the FastAPI backend. Use the
          endpoint below to verify the connection.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Try the API</label>
          <div className="form-row">
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Say hello"}
            </button>
          </div>
        </form>
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
