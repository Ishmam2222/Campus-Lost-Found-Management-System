# Technical Design Document (TDD) — Campus Lost & Found

| Field | Value |
|---|---|
| Product | Campus Lost & Found Management System |
| Releases | MVP — Mid-term; Beta — Final |
| Status | Draft |
| Related docs | [PRD](PRD.md), [SRS](SRS.md) |

## 1. Overview

- **MVP:** A local React + TypeScript frontend uses a FastAPI REST API to manage lost/found reports.
- **Beta:** Add user accounts, a profile dashboard, member/admin roles, security scopes, and deployment.

The repository currently contains the framework scaffold. Report CRUD and Beta features are planned work.

## 2. Technology

| Layer | Technology | Release |
|---|---|---|
| Frontend | React, TypeScript, Vite | MVP |
| Backend | Python, FastAPI | MVP |
| API | JSON REST endpoints | MVP |
| Local data storage | SQLite | MVP |
| Authentication | Signed access tokens and password hashing | Beta |
| Deployment | Vercel or another course-approved host | Beta |

## 3. Architecture

```text
Browser
  └── React + TypeScript frontend
        └── /api requests
              └── FastAPI backend
                    └── Database
```

For local development, Vite proxies `/api` requests to the FastAPI server. In Beta, deployed frontend requests use the configured API routes.


## 4. Project structure

```text
backend/
  main.py             # FastAPI application entrypoint
  models.py           # SQLModel tables and Pydantic schemas
  database.py         # Database engine and session management
  security.py         # Argon2/PBKDF2 password hashing, JWT tokens, and RBAC dependencies
  crud.py             # Database repository queries
  service.py          # Business logic and permission enforcement
  routers/
    items.py          # Report CRUD endpoints
    auth.py           # Registration, login, and logout endpoints
    profile.py        # User profile and password endpoints
    admin.py          # Admin statistics, roles, and user management

frontend/
  src/
    App.tsx           # Root application state and navigation
    api.ts            # REST API client functions
    types.ts          # TypeScript interfaces
    components/       # Reusable UI components (Header, FilterBar, ItemCard, ItemList, Modals)
    pages/            # Application pages (LoginPage, SignupPage, ProfilePage, AdminPage)

docs/
  01-prd.md
  02-srs.md
  03-tdd.md
```

Keep the structure modular and separated by layer.


## 5. Data model


### Report — MVP


| Field | Description |
| --- | --- |
| `id` | Unique report identifier |
| `type` | `lost` or `found` |
| `title` | Short item title |
| `description` | Item details |
| `category` | Item category |
| `location` | Where it was lost or found |
| `created_at` | Date and time the report was created |



### User — Beta


| Field | Description |
| --- | --- |
| `id` | Unique account identifier |
| `email` | Unique user email |
| `password_hash` | Secure password hash; never returned by the API |
| `role` | `member` or `admin` |


## 6. REST API


All endpoints use the `/api` prefix and JSON.


### MVP endpoints


| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/items` | List reports |
| `POST` | `/api/items` | Create a report |
| `GET` | `/api/items/{id}` | View one report |
| `PUT` | `/api/items/{id}` | Update a report |
| `DELETE` | `/api/items/{id}` | Delete a report |
| `GET` | `/api/health` | Check that the API is running |



The API validates request data and returns appropriate errors, such as `404` for a report that does not exist and `422` for invalid input.


### Beta endpoints


| Method | Path | Purpose |

| `POST` | `/api/auth/register` | Register as a member |
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/profile` | View the signed-in user's profile |



The existing report endpoints become protected in Beta. The API checks the user's role, required scope, and report ownership before allowing protected actions.


## 7. Security — Beta



- Hash passwords using a maintained password-hashing library.

- Keep signing keys and other secrets in environment configuration.

- Do not allow users to assign themselves the admin role.

- Check permissions in FastAPI for every protected endpoint.

- Return `401` for missing or invalid authentication and `403` for insufficient permissions.

- Use HTTPS for the deployed application.



## 8. Testing



- **MVP:** Test report creation, listing, reading, updating, deletion, and invalid input.

- **MVP:** Verify that the frontend can use the local FastAPI API.

- **Beta:** Test login, roles, scopes, and denied access for unauthorized users.

- **Beta:** Check that the deployed app uses HTTPS and does not expose secrets.

## 9. Deployment and configuration

### MVP — local development

- Run the FastAPI backend locally and the React frontend with Vite.
- Configure Vite to proxy frontend `/api` requests to the local backend.
- Use a local database for report data.
- Keep local environment settings in an untracked `.env` file when needed.

### Beta — deployment

- Deploy the frontend and FastAPI backend using the repository's Vercel
  configuration or another course-approved platform.
- Configure the deployed frontend so API requests reach the backend through
  the `/api` routes.
- Use a persistent database suitable for the hosting platform.
- Serve production traffic over HTTPS.
- Store deployment configuration and secrets in the hosting provider's
  environment settings, not in source code or frontend files.

### Configuration

| Setting | Use | Release |
|---|---|---|
| `DATABASE_URL` | Database connection string | MVP locally; Beta deployment |
| `JWT_SECRET` | Signs and verifies authentication tokens | Beta |
| `FRONTEND_ORIGIN` | Allowed frontend origin, if separate CORS configuration is needed | Beta |

The application should fail clearly when required deployment settings are
missing. Never commit real credentials or secret values to Git.

## 10. Auth and RBAC design — Beta

### 10.1 Token design
- **Access Token:** Short-lived JWT (15 minutes). Carries `sub` (user email), `id` (user ID), `role` (`user`, `moderator`, `admin`), `name`, `jti` (unique JWT id), and `exp` (expiration). Signed using HMAC-SHA256 (`HS256`) with `JWT_SECRET`.
- **Refresh Token:** Longer-lived JWT (7 days). Exchanged via `POST /api/auth/refresh` to issue a new access token and rotating refresh token.
- **Revocation / Logout:** Calling `POST /api/auth/logout` stores the token's `jti` in the `revoked_tokens` table. In-flight tokens matching revoked `jti` are immediately rejected with HTTP `401`.

### 10.2 Lockout and brute-force protection
- Every user record tracks `failed_attempts` (integer) and `locked_until` (datetime).
- On each failed login password attempt, `failed_attempts` increments by 1.
- When `failed_attempts >= 5`, `locked_until` is set to `now + 15 minutes` and an error HTTP `429 Too Many Requests` is returned.
- Successful login resets `failed_attempts = 0` and clears `locked_until`.

### 10.3 RBAC architecture & dependencies
Permissions are enforced on the backend via FastAPI dependencies in `backend/rbac.py` and `backend/security.py`:
- `get_current_user`: Validates JWT signature, expiration, and checks token revocation blacklist. Returns the authenticated `User` model.
- `require_role(["admin"])`: Ensures `current_user.role == "admin"`; returns `403 Forbidden` if insufficient.
- `require_role(["moderator", "admin"])`: Allows desk staff and administrators access to desk and moderate endpoints.
- **Item Ownership Enforcement:** Handled in `backend/service.py`:
  - `user`: Can only update or delete an item if `item.owner_id == current_user.id`.
  - `moderator` / `admin`: Authorized to update or delete any report, resolve status, or reassign desks.

### 10.4 Admin dashboard stats
One endpoint (`GET /api/admin/stats`) aggregating database metrics:
- Total registered users and role distribution (`user`, `moderator`, `admin`).
- Total lost reports vs. total found reports.
- Total resolved reports vs. active reports.
- Recent 7-day activity volume.

## 11. Security — Beta

| Area | Implementation Design |
|---|---|
| Passwords | Salted Argon2 / PBKDF2 hashing via `passlib`; plain text passwords are never stored or logged |
| JWT Tokens | Cryptographically signed with `HS256`; `JWT_SECRET` loaded strictly from environment variables |
| Token Revocation | Database `revoked_tokens` blacklist; tokens cannot be reused after logout |
| Brute Force | 5 failed login attempts trigger an automatic 15-minute account lockout (`429`) |
| Role Security | Default registration always assigns `user`; `admin` and `moderator` roles cannot be self-assigned |
| CORS & Headers | Vercel deployment enforces HTTPS; Vite proxies `/api` during local development |
| SQL Injection | Prevented by SQLModel / SQLAlchemy parameterised queries (no raw string concatenation) |
| Data Exposure | Response models (`UserRead`, `ItemRead`) explicitly exclude `password_hash` and internal security fields |

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }
]
```

## 12. Migrations

- **Database Evolution:**
  - **MVP:** Single SQLite database table `item` storing lost and found items.
  - **Beta:** Schema expanded to 4 tables: `users`, `items`, `team_groups`, and `revoked_tokens`.
- **Automatic Seed & Column Migration:**
  - `backend/database.py` calls `create_db_and_tables()` on startup via SQLModel metadata.
  - `backend/service.py` (`seed_initial_data`) verifies and seeds initial campus desks (`Security Desk`, `Library Front Desk`, `IT Helpdesk`) and default demo accounts (`ammar@campus.edu`, `sajid@campus.edu`, `admin@campus.edu`).
- **Production Hosted DB:**
  - For cloud deployment, setting `DATABASE_URL` connects to PostgreSQL (e.g. Neon or Supabase) seamlessly without altering application code.

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Serverless cold starts on Vercel | Initial API call takes 1-2s longer | Acceptable for demo; keep endpoints lightweight with fast imports |
| Database file reset on serverless redeploy | SQLite in `/tmp` resets between deployments | Connect hosted PostgreSQL (`DATABASE_URL`) on Neon/Supabase for persistent production data |
| JWT Secret leakage | Compromised token verification | Store `JWT_SECRET` only in Vercel environment variables, never commit `.env` to Git |
| Unauthorized report modification | Users modifying others' posts | Enforce item ownership check in backend service layer (`owner_id == user.id`), returning `403` |
| Token replay attacks | Reusing old tokens | Short 15-minute access token lifespan, rotating refresh tokens, and revocation blacklist on logout |
